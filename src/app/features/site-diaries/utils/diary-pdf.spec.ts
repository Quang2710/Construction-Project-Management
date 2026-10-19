import { SiteDiary } from '../models/site-diary.model';
import { buildDiaryPdfDefinition } from './diary-pdf';

const DIARY: SiteDiary = {
  id: 'dry-1',
  projectId: 'prj-gthm',
  project: { id: 'prj-gthm', code: 'HN-GTHM', name: 'Chung cư Green Tower Hoàng Mai', lat: 20.9846, lng: 105.8649 },
  date: '2026-10-16',
  weather: { morning: 'SUNNY', afternoon: 'HEAVY_RAIN', minTemp: 24, maxTemp: 31 },
  labor: [
    { crew: 'Tổ cốt thép', headcount: 12 },
    { crew: 'Tổ bê tông', headcount: 8 },
  ],
  equipment: [{ name: 'Cần trục tháp', quantity: 1, hours: 8 }],
  workItems: [{ description: 'Đổ bê tông sàn tầng 12', unit: 'm³', quantity: 85.5 }],
  incidents: [
    { type: 'SAFETY', severity: 'LOW', description: 'Trầy xước tay khi tháo cốp pha.', actionTaken: 'Sơ cứu tại chỗ.' },
  ],
  notes: 'Họp giao ban 7h30.',
  photos: [
    {
      id: 'p1',
      url: '/api/v1/files/p1',
      fileName: 'IMG_001.jpg',
      mimeType: 'image/jpeg',
      size: 1000,
      caption: 'Đổ bê tông',
      takenAt: '2026-10-16T02:00:00.000Z',
      location: { lat: 20.9849, lng: 105.8651, accuracy: 10 },
    },
    {
      id: 'p2',
      url: '/api/v1/files/p2',
      fileName: 'IMG_002.jpg',
      mimeType: 'image/jpeg',
      size: 1000,
      caption: 'Ảnh lỗi',
      takenAt: '2026-10-16T03:00:00.000Z',
      location: null,
    },
  ],
  status: 'APPROVED',
  totalWorkers: 20,
  createdBy: { id: 'usr-engineer', fullName: 'Lê Hoàng Cường', jobTitle: 'Chỉ huy trưởng', role: 'SITE_ENGINEER' },
  reviewNote: 'Đồng ý.',
  history: [
    { action: 'APPROVED', by: { id: 'usr-pm', fullName: 'Trần Thị Bình', jobTitle: '', role: 'PROJECT_MANAGER' }, at: '2026-10-17T02:00:00.000Z', note: 'Đồng ý.' },
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-17T02:00:00.000Z',
};

describe('buildDiaryPdfDefinition', () => {
  const definition = buildDiaryPdfDefinition(DIARY, new Map([['p1', 'data:image/jpeg;base64,AAAA']]));
  const text = JSON.stringify(definition.content);

  it('có tiêu đề, thông tin dự án và các mục báo cáo bằng tiếng Việt', () => {
    expect(text).toContain('NHẬT KÝ THI CÔNG XÂY DỰNG');
    expect(text).toContain('HN-GTHM — Chung cư Green Tower Hoàng Mai');
    expect(text).toContain('Sáng: Nắng · Chiều: Mưa to · 24–31 °C');
    expect(text).toContain('20 người');
    expect(text).toContain('Tổ cốt thép');
    expect(text).toContain('Đổ bê tông sàn tầng 12');
    expect(text).toContain('Trầy xước tay khi tháo cốp pha.');
    expect(text).toContain('Trần Thị Bình');
  });

  it('chỉ nhúng ảnh đã tải được, kèm khoảng cách tới công trình', () => {
    expect(text).toContain('data:image/jpeg;base64,AAAA');
    expect(text).not.toContain('Ảnh lỗi');
    expect(text).toContain('cách công trình');
  });

  it('khổ A4, font Roboto (hỗ trợ tiếng Việt)', () => {
    expect(definition.pageSize).toBe('A4');
    expect(definition.defaultStyle?.font).toBe('Roboto');
  });
});
