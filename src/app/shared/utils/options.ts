/** Phần tử lựa chọn cho p-select / p-selectbutton (optionLabel="label", optionValue="value"). */
export interface SelectOption<T> {
  readonly label: string;
  readonly value: T;
}

/** Danh sách giá trị enum + bảng nhãn tiếng Việt → options cho dropdown. */
export function toOptions<T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>): SelectOption<T>[] {
  return values.map((value) => ({ label: labels[value], value }));
}

/** Giá trị đặc biệt "Tất cả" cho bộ lọc (p-select / p-selectbutton không nhận null làm value của option). */
export const ALL_OPTION = 'ALL';

/** Như toOptions nhưng thêm lựa chọn "Tất cả" ở đầu. */
export function withAllOption<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
  allLabel = 'Tất cả',
): SelectOption<T | typeof ALL_OPTION>[] {
  return [{ label: allLabel, value: ALL_OPTION }, ...toOptions(values, labels)];
}

/** Đổi giá trị bộ lọc từ control (có thể là "Tất cả") về null. */
export function fromAllOption<T extends string>(value: unknown): T | null {
  return typeof value === 'string' && value !== ALL_OPTION ? (value as T) : null;
}
