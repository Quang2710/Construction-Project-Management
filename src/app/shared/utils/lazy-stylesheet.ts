const loaded = new Map<string, Promise<void>>();

/** Nạp stylesheet build riêng (angular.json: inject: false) một lần khi cần. */
export function loadStylesheet(document: Document, href: string): Promise<void> {
  const existing = loaded.get(href);
  if (existing) {
    return existing;
  }
  const promise = new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    // Lỗi tải CSS không chặn trang; chỉ mất định dạng của thư viện.
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  loaded.set(href, promise);
  return promise;
}
