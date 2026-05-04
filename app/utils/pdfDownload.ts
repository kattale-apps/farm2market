import { Capacitor } from "@capacitor/core";

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

export async function savePdfFromJsPDF(doc: any, filename: string): Promise<void> {
  const safeFilename = normalizePdfFilename(filename);

  if (!Capacitor.isNativePlatform()) {
    doc.save(safeFilename);
    return;
  }

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    const pdfBlob: Blob = doc.output("blob");
    const base64 = await blobToBase64(pdfBlob);
    const saved = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    const shareAvailability = await Share.canShare();
    if (shareAvailability.value) {
      await Share.share({
        title: "PDF Export",
        text: `Saved ${safeFilename}`,
        url: saved.uri,
        dialogTitle: "Save or share PDF",
      });
    }
  } catch (error) {
    console.error("Mobile PDF save failed, falling back to browser download", error);
    doc.save(safeFilename);
  }
}
