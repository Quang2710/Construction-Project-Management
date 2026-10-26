/** Màu chồng lớp so sánh bản vẽ (quy ước phổ biến của phần mềm so sánh bản vẽ). */
export const DIFF_COLORS = {
  /** Chỉ có ở phiên bản cũ (đã xoá). */
  removed: [220, 38, 38],
  /** Chỉ có ở phiên bản mới (thêm mới). */
  added: [37, 99, 235],
  /** Giống nhau: xám nhạt để làm nền. */
  unchanged: [185, 185, 185],
} as const;

export interface ImageDiffResult {
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  readonly removed: number;
  readonly added: number;
  /** % điểm ảnh có nét bị thay đổi trên tổng số điểm ảnh có nét. */
  readonly changedPercent: number;
}

/** Điểm ảnh có "mực" (tối hơn ngưỡng) – bản vẽ là nét tối trên nền trắng. */
function inked(data: Uint8ClampedArray, offset: number, threshold: number): boolean {
  const alpha = data[offset + 3] / 255;
  // Nền trong suốt coi như trắng.
  const luminance = (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) * alpha + 255 * (1 - alpha);
  return luminance < threshold;
}

/**
 * So sánh hai ảnh RGBA cùng kích thước, trả về ảnh chồng lớp:
 * đỏ = chỉ có ở bản cũ, xanh = chỉ có ở bản mới, xám = không đổi, trắng = nền.
 */
export function diffImages(before: Uint8ClampedArray, after: Uint8ClampedArray, threshold = 200): ImageDiffResult {
  if (before.length !== after.length) {
    throw new Error('Hai ảnh phải cùng kích thước.');
  }
  const pixels = new Uint8ClampedArray(before.length);
  let removed = 0;
  let added = 0;
  let inkedTotal = 0;
  for (let offset = 0; offset < before.length; offset += 4) {
    const a = inked(before, offset, threshold);
    const b = inked(after, offset, threshold);
    const color = a && b ? DIFF_COLORS.unchanged : a ? DIFF_COLORS.removed : b ? DIFF_COLORS.added : null;
    if (a || b) {
      inkedTotal += 1;
    }
    if (a && !b) {
      removed += 1;
    } else if (b && !a) {
      added += 1;
    }
    pixels[offset] = color ? color[0] : 255;
    pixels[offset + 1] = color ? color[1] : 255;
    pixels[offset + 2] = color ? color[2] : 255;
    pixels[offset + 3] = 255;
  }
  const changedPercent = inkedTotal === 0 ? 0 : Math.round(((removed + added) / inkedTotal) * 1000) / 10;
  return { pixels, removed, added, changedPercent };
}
