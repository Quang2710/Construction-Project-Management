const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/** 450000000000 -> "450.000.000.000 ₫" */
export function formatVnd(amount: number): string {
  return VND_FORMATTER.format(amount);
}

/** 450000000000 -> "450 tỷ", 125500000 -> "125,5 triệu" */
export function formatVndCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e9) {
    return `${DECIMAL_FORMATTER.format(amount / 1e9)} tỷ`;
  }
  if (abs >= 1e6) {
    return `${DECIMAL_FORMATTER.format(amount / 1e6)} triệu`;
  }
  return formatVnd(amount);
}
