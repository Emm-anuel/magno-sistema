export interface CompressOptions {
  maxWidthPx?: number;   // default 1600
  maxHeightPx?: number;  // default 1200
  quality?: number;      // 0–1, default 0.82
  outputFormat?: 'jpeg' | 'webp';  // default 'jpeg'
}

export function compressImage(file: File, options?: CompressOptions): Promise<File> {
  const maxWidthPx = options?.maxWidthPx ?? 1600;
  const maxHeightPx = options?.maxHeightPx ?? 1200;
  const quality = options?.quality ?? 0.82;
  const outputFormat = options?.outputFormat ?? 'jpeg';
  const mimeType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';

  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error(`FileReader failed to read file: ${file.name}`));
    };

    reader.onload = (readerEvent) => {
      const dataUrl = readerEvent.target?.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('FileReader did not produce a DataURL string'));
        return;
      }

      const img = new Image();

      img.onerror = () => {
        reject(new Error(`Failed to load image from DataURL for file: ${file.name}`));
      };

      img.onload = () => {
        let { width, height } = img;

        // Scale down proportionally if needed
        if (width > maxWidthPx) {
          height = Math.round((height * maxWidthPx) / width);
          width = maxWidthPx;
        }
        if (height > maxHeightPx) {
          width = Math.round((width * maxHeightPx) / height);
          height = maxHeightPx;
        }

        // If image already fits within both limits, return original unchanged
        if (width === img.width && height === img.height) {
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('canvas.toBlob() returned null — compression failed'));
              return;
            }

            // Always use .jpg extension for S3 consistency
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const newFileName = `${baseName}.jpg`;

            const compressedFile = new File([blob], newFileName, { type: mimeType });

            const originalMB = (file.size / 1024 / 1024).toFixed(2);
            const compressedMB = (compressedFile.size / 1024 / 1024).toFixed(2);
            const reductionPct = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);

            console.log(
              `Imagen comprimida: ${originalMB}MB → ${compressedMB}MB (-${reductionPct}%)`
            );

            resolve(compressedFile);
          },
          mimeType,
          quality
        );
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}
