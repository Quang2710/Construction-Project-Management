/** Wrapper an toàn cho localStorage (trình duyệt chặn storage sẽ không làm vỡ app). */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Bỏ qua: chỉ mất khả năng ghi nhớ giữa các lần tải trang.
  }
}
