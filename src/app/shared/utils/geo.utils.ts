export interface GeoPosition {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: number | null;
}

export type GeoResult =
  | { readonly ok: true; readonly position: GeoPosition }
  | { readonly ok: false; readonly reason: string };

const GEO_ERRORS: Readonly<Record<number, string>> = {
  1: 'Bạn chưa cho phép truy cập vị trí.',
  2: 'Không xác định được vị trí (GPS yếu).',
  3: 'Lấy vị trí quá thời gian chờ.',
};

/** Lấy vị trí hiện tại bằng Geolocation API (cần HTTPS hoặc localhost). */
export function getCurrentPosition(timeoutMs = 10_000): Promise<GeoResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, reason: 'Thiết bị không hỗ trợ định vị.' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          position: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
          },
        }),
      (error) => resolve({ ok: false, reason: GEO_ERRORS[error.code] ?? 'Không lấy được vị trí.' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Khoảng cách (m) giữa hai toạ độ theo công thức haversine. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 85 -> "85 m", 1530 -> "1,5 km" */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=18/${lat.toFixed(6)}/${lng.toFixed(6)}`;
}
