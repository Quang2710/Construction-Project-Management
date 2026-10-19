const DEFAULT_MAX_SIZE = 1600;
const DEFAULT_QUALITY = 0.82;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không tải được ảnh: ${src}`));
    image.src = src;
  });
}

function scaleToFit(width: number, height: number, maxSize: number): { width: number; height: number } {
  const ratio = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Trình duyệt không hỗ trợ canvas.');
  }
  // Nền trắng để ảnh PNG/SVG trong suốt không bị đen khi chuyển JPEG.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * Thu nhỏ & nén ảnh chụp từ điện thoại (thường 4000px, 5MB) trước khi tải lên,
 * giữ đúng hướng xoay EXIF. Trả về JPEG.
 */
export async function compressImage(file: Blob, maxSize = DEFAULT_MAX_SIZE, quality = DEFAULT_QUALITY): Promise<Blob> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = (): void => undefined;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bitmap;
    ({ width, height } = bitmap);
    cleanup = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(url);
  }

  try {
    const size = scaleToFit(width, height, maxSize);
    const canvas = drawToCanvas(source, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không nén được ảnh.'))), 'image/jpeg', quality),
    );
  } finally {
    cleanup();
  }
}

/** Tải ảnh theo URL (cùng origin) và chuyển thành data URL JPEG — dùng để nhúng vào PDF. */
export async function imageUrlToDataUrl(url: string, maxSize = 1000, quality = 0.8): Promise<string> {
  const image = await loadImage(url);
  const size = scaleToFit(image.naturalWidth || 800, image.naturalHeight || 600, maxSize);
  return drawToCanvas(image, size.width, size.height).toDataURL('image/jpeg', quality);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
