import { computeCriticalPath, edgeKey, ScheduleTask } from './critical-path';

/*
 * A(1–5) → B(5–10) → D(10–12)
 * A(1–5) → C(5–7)  → D        C có dự trữ 3 ngày
 */
const TASKS: ScheduleTask[] = [
  { id: 'A', startDate: '2026-01-01', dueDate: '2026-01-05', dependencyIds: [] },
  { id: 'B', startDate: '2026-01-05', dueDate: '2026-01-10', dependencyIds: ['A'] },
  { id: 'C', startDate: '2026-01-05', dueDate: '2026-01-07', dependencyIds: ['A'] },
  { id: 'D', startDate: '2026-01-10', dueDate: '2026-01-12', dependencyIds: ['B', 'C'] },
];

describe('computeCriticalPath', () => {
  it('đường găng là chuỗi dài nhất A → B → D', () => {
    const result = computeCriticalPath(TASKS);
    expect([...result.critical].sort()).toEqual(['A', 'B', 'D']);
    expect(result.floatDays.get('C')).toBe(3);
    expect(result.finishDate).toBe('2026-01-12');
    expect(result.violations.size).toBe(0);
  });

  it('kéo dài C quá B thì C trở thành găng, B có dự trữ', () => {
    const tasks = TASKS.map((task) =>
      task.id === 'C' ? { ...task, dueDate: '2026-01-11' } : task.id === 'D' ? { ...task, startDate: '2026-01-11', dueDate: '2026-01-13' } : task,
    );
    const result = computeCriticalPath(tasks);
    expect(result.critical.has('C')).toBe(true);
    expect(result.floatDays.get('B')).toBe(1);
  });

  it('phát hiện vi phạm FS (bắt đầu trước khi công việc trước xong)', () => {
    const tasks = TASKS.map((task) => (task.id === 'B' ? { ...task, startDate: '2026-01-03' } : task));
    const result = computeCriticalPath(tasks);
    expect(result.violations.has(edgeKey('A', 'B'))).toBe(true);
  });

  it('danh sách rỗng', () => {
    expect(computeCriticalPath([]).finishDate).toBeNull();
  });
});
