/**
 * Shrink a photo in the browser before it is uploaded, so uploads stay small
 * on slow field connections and storage stays light.
 */
export async function compressImage(file: Blob, maxDimension: number, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read this photo"));
      el.src = url;
    });
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process this photo");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process this photo"))), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadToConvex(uploadUrl: string, blob: Blob): Promise<string> {
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  if (!res.ok) throw new Error("Photo upload failed. Check your connection and try again.");
  const { storageId } = await res.json();
  return storageId as string;
}
