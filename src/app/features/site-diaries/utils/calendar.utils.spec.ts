import { buildMonthGrid, gridRange, parseMonth } from './calendar.utils';

describe('calendar.utils', () => {
  it('lưới tháng 10/2026 bắt đầu thứ Hai 28/09 và kết thúc Chủ nhật 01/11', () => {
    const weeks = buildMonthGrid('2026-10', '2026-10-18');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toMatchObject({ date: '2026-09-28', inMonth: false });
    expect(weeks[4][6]).toMatchObject({ date: '2026-11-01', inMonth: false, isSunday: true });
  });

  it('đánh dấu hôm nay và Chủ nhật', () => {
    const days = buildMonthGrid('2026-10', '2026-10-18').flat();
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2026-10-18']);
    expect(days.find((day) => day.date === '2026-10-18')?.isSunday).toBe(true);
    expect(days.find((day) => day.date === '2026-10-19')?.isSunday).toBe(false);
  });

  it('gridRange khớp ô đầu/cuối của lưới', () => {
    expect(gridRange('2026-02')).toEqual({ from: '2026-01-26', to: '2026-03-01' });
    expect(parseMonth('2026-02').getMonth()).toBe(1);
  });
});
