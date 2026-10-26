import { nextRevisionLabel } from '../models/document.model';
import { DIFF_COLORS, diffImages } from './image-diff';

/** Ảnh 1 hàng, mỗi phần tử: true = nét đen, false = nền trắng. */
function image(pixels: readonly boolean[]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flatMap((ink) => (ink ? [0, 0, 0, 255] : [255, 255, 255, 255])));
}

function colorAt(data: Uint8ClampedArray, index: number): number[] {
  return Array.from(data.slice(index * 4, index * 4 + 3));
}

describe('diffImages', () => {
  it('đỏ = chỉ có ở bản cũ, xanh = chỉ có ở bản mới, xám = giữ nguyên, trắng = nền', () => {
    const before = image([true, true, false, false]);
    const after = image([true, false, true, false]);
    const result = diffImages(before, after);
    expect(colorAt(result.pixels, 0)).toEqual([...DIFF_COLORS.unchanged]);
    expect(colorAt(result.pixels, 1)).toEqual([...DIFF_COLORS.removed]);
    expect(colorAt(result.pixels, 2)).toEqual([...DIFF_COLORS.added]);
    expect(colorAt(result.pixels, 3)).toEqual([255, 255, 255]);
    expect(result).toMatchObject({ removed: 1, added: 1, changedPercent: 66.7 });
  });

  it('nền trong suốt coi như trắng; hai ảnh giống hệt → 0% thay đổi', () => {
    const transparent = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]);
    const result = diffImages(transparent, transparent);
    expect(result.changedPercent).toBe(0);
    expect(colorAt(result.pixels, 0)).toEqual([255, 255, 255]);
    expect(colorAt(result.pixels, 1)).toEqual([...DIFF_COLORS.unchanged]);
  });

  it('khác kích thước thì báo lỗi', () => {
    expect(() => diffImages(image([true]), image([true, false]))).toThrow();
  });
});

describe('nextRevisionLabel', () => {
  it('A → B, Z → AA, AZ → BA; chưa có → A', () => {
    expect(nextRevisionLabel('')).toBe('A');
    expect(nextRevisionLabel('A')).toBe('B');
    expect(nextRevisionLabel('Z')).toBe('AA');
    expect(nextRevisionLabel('AZ')).toBe('BA');
  });
});
