function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index++) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Ảnh minh hoạ cho dữ liệu seed (không có ảnh thật): bầu trời, công trình, cần trục và chú thích.
 * Màu thay đổi theo id để mỗi ảnh trông khác nhau.
 */
export function placeholderPhotoSvg(id: string, caption: string, subtitle: string): string {
  const seed = hash(id);
  const skyHue = 190 + (seed % 40);
  const floors = 4 + (seed % 7);
  const buildingX = 180 + (seed % 160);
  const floorHeight = 34;
  const top = 470 - floors * floorHeight;
  const floorsSvg = Array.from({ length: floors }, (_, index) => {
    const y = 470 - (index + 1) * floorHeight;
    return `<rect x="${buildingX}" y="${y}" width="300" height="${floorHeight - 6}" fill="#9ca3af"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${skyHue},70%,72%)"/>
      <stop offset="1" stop-color="hsl(${skyHue},60%,90%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#sky)"/>
  <rect y="470" width="800" height="130" fill="#a16207"/>
  <rect y="470" width="800" height="16" fill="#854d0e"/>
  ${floorsSvg}
  <rect x="${buildingX - 8}" y="${top - 6}" width="316" height="6" fill="#6b7280"/>
  <rect x="${buildingX + 340}" y="${top - 140}" width="14" height="${610 - top}" fill="#f59e0b"/>
  <rect x="${buildingX + 120}" y="${top - 150}" width="340" height="12" fill="#f59e0b"/>
  <line x1="${buildingX + 180}" y1="${top - 138}" x2="${buildingX + 180}" y2="${top - 40}" stroke="#374151" stroke-width="3"/>
  <rect x="${buildingX + 166}" y="${top - 42}" width="28" height="18" fill="#374151"/>
  <rect y="530" width="800" height="70" fill="rgba(0,0,0,0.55)"/>
  <text x="24" y="562" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff">${escapeXml(caption)}</text>
  <text x="24" y="588" font-family="Arial, sans-serif" font-size="18" fill="#e5e7eb">${escapeXml(subtitle)}</text>
</svg>`;
}
