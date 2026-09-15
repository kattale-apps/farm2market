import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Saving a generated PDF, on the web and inside the Android app.
 *
 * The Android build does not bundle this site — capacitor.config.ts points
 * server.url at the live domain, so the WebView loads the same JavaScript the
 * browser does. That matters here: a dynamic `import("@capacitor/filesystem")`
 * compiles to a bare module specifier, which a WebView has no import map to
 * resolve, so it threw on every native export and fell through to the browser
 * download path. Blob downloads are then dropped by the Android WebView, which
 * registers no DownloadListener, so the file silently never appeared.
 *
 * registerPlugin goes through the Capacitor bridge to the natively installed
 * plugin instead of trying to load its JavaScript package, which is the
 * supported route for a remote-served app.
 */

type FilesystemPlugin = {
  writeFile(options: {
    path: string;
    data: string;
    directory?: string;
    recursive?: boolean;
  }): Promise<{ uri: string }>;
};

type SharePlugin = {
  canShare(): Promise<{ value: boolean }>;
  share(options: {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
  }): Promise<void>;
};

// "DOCUMENTS" is the value of the Directory.Documents enum. It is written out
// literally because the enum lives in the package we deliberately do not load.
const DOCUMENTS_DIRECTORY = "DOCUMENTS";

const Filesystem = registerPlugin<FilesystemPlugin>("Filesystem");
const Share = registerPlugin<SharePlugin>("Share");

export type PdfSaveResult =
  | { ok: true; method: "browser" | "shared" | "saved"; filename: string; uri?: string }
  | { ok: false; filename: string; error: string };

function normalizePdfFilename(filename: string): string {
  return filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read PDF blob"));
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function savePdfFromJsPDF(doc: any, filename: string): Promise<PdfSaveResult> {
  const safeFilename = normalizePdfFilename(filename);

  if (!Capacitor.isNativePlatform()) {
    try {
      doc.save(safeFilename);
      return { ok: true, method: "browser", filename: safeFilename };
    } catch (error: any) {
      return { ok: false, filename: safeFilename, error: error?.message || "Download failed" };
    }
  }

  // The plugin has to be registered natively, not just present in JavaScript.
  // Every APK built before the plugin manifest was regenerated ships without
  // Filesystem, and the bridge call simply rejects. Checking first means an out
  // of date app says so, rather than reporting a save that never happened.
  if (!Capacitor.isPluginAvailable("Filesystem")) {
    return {
      ok: false,
      filename: safeFilename,
      error:
        "This version of the app cannot save files. Please update the app from the Play Store, " +
        "or open the site in your phone's browser to download.",
    };
  }

  try {
    const pdfBlob: Blob = doc.output("blob");
    const base64 = await blobToBase64(pdfBlob);
    const saved = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: DOCUMENTS_DIRECTORY,
      recursive: true,
    });

    // Sharing is what actually lets someone open or forward the file; writing
    // it to Documents alone leaves it somewhere most users never look. If the
    // share sheet is unavailable the file is still on disk, so that counts as
    // success and the caller tells them where it went.
    try {
      const availability = await Share.canShare();
      if (availability?.value) {
        await Share.share({
          title: "PDF Export",
          text: safeFilename,
          url: saved.uri,
          dialogTitle: "Save or share PDF",
        });
        return { ok: true, method: "shared", filename: safeFilename, uri: saved.uri };
      }
    } catch {
      // Dismissing the share sheet rejects; the file is saved either way.
    }

    return { ok: true, method: "saved", filename: safeFilename, uri: saved.uri };
  } catch (error: any) {
    // Deliberately not falling back to doc.save() here. The Android WebView
    // registers no DownloadListener, so a blob download does nothing and throws
    // nothing — reporting success off the back of it is how a failed save came
    // to look like a save that worked.
    return {
      ok: false,
      filename: safeFilename,
      error: error?.message || "Could not save the PDF on this device",
    };
  }
}
