import { isTaskOverdue, orderBetween } from './task.utils';

describe('task.utils', () => {
  it('orderBetween: cột rỗng, đầu cột, cuối cột, giữa hai thẻ', () => {
    expect(orderBetween(undefined, undefined)).toBe(1000);
    expect(orderBetween(undefined, 1000)).toBe(0);
    expect(orderBetween(3000, undefined)).toBe(4000);
    expect(orderBetween(1000, 2000)).toBe(1500);
  });

  it('isTaskOverdue: quá hạn khi chưa hoàn thành và hạn trước hôm nay', () => {
    expect(isTaskOverdue({ dueDate: '2026-01-01', status: 'IN_PROGRESS' }, '2026-01-02')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-01-01', status: 'DONE' }, '2026-01-02')).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-01-02', status: 'TODO' }, '2026-01-02')).toBe(false);
  });
});
