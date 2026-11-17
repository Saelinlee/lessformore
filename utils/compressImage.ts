/**
 * Compresses and resizes a mobile camera image on an HTML5 canvas
 * so the payload stays under ~200KB for fast Gemini Vision inference.
 */
export interface CompressedImageResult {
  base64: string;
  mimeType: string;
}

export async function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.7
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down proportionally if image exceeds maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to initialize 2D canvas context."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as compressed JPEG and strip the data URL header
        const mimeType = "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(",")[1];

        resolve({ base64, mimeType });
      };

      img.onerror = () => reject(new Error("Failed to load image file."));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file input."));
    reader.readAsDataURL(file);
  });
}
