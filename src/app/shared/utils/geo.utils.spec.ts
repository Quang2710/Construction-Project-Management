import { distanceMeters, formatDistance } from './geo.utils';

describe('geo.utils', () => {
  it('khoảng cách Hà Nội – TP.HCM khoảng 1.140 km', () => {
    const hanoi = { lat: 21.0285, lng: 105.8542 };
    const saigon = { lat: 10.7769, lng: 106.7009 };
    expect(distanceMeters(hanoi, saigon) / 1000).toBeCloseTo(1140, -1);
  });

  it('cùng một điểm cách 0 m; lệch 0.001° vĩ độ ≈ 111 m', () => {
    const point = { lat: 20.98, lng: 105.86 };
    expect(distanceMeters(point, point)).toBe(0);
    expect(distanceMeters(point, { lat: 20.981, lng: 105.86 })).toBeCloseTo(111, 0);
  });

  it('định dạng m / km theo kiểu Việt Nam', () => {
    expect(formatDistance(85.4)).toBe('85 m');
    expect(formatDistance(1530)).toBe('1,5 km');
  });
});
