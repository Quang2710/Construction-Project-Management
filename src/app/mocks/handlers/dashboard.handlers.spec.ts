import { DashboardSummary } from '../../features/dashboard/models/dashboard.model';
import { callApi, json, resetMockBackend, tokenFor } from '../testing/handler-testing';

async function summaryFor(role: 'pm' | 'engineer'): Promise<DashboardSummary> {
  return json<DashboardSummary>(await callApi('/dashboard/summary', { token: await tokenFor(role) }));
}

describe('Fake BE: /dashboard/summary', () => {
  beforeAll(() => resetMockBackend());

  it('KPI tính từ dữ liệu DB', async () => {
    const { kpis, costByProject, overdueTasks } = await summaryFor('pm');
    expect(kpis.totalProjects).toBe(8);
    expect(kpis.activeProjects).toBe(5);
    expect(kpis.delayedProjects).toBeGreaterThan(0);
    expect(kpis.overBudgetProjects).toBeGreaterThan(0);
    expect(kpis.overdueTasks).toBeGreaterThan(0);
    expect(costByProject).toHaveLength(8);
    expect(overdueTasks.length).toBeLessThanOrEqual(8);
    // Danh sách cảnh báo sắp theo hạn trễ nhất trước.
    const dueDates = overdueTasks.map((task) => task.dueDate);
    expect(dueDates).toEqual([...dueDates].sort());
  });

  it('S-curve: kế hoạch không giảm, thực tế chỉ có ở quá khứ', async () => {
    const { sCurve } = await summaryFor('pm');
    expect(sCurve.labels.length).toBeGreaterThan(12);
    expect(sCurve.planned.every((value, index) => index === 0 || value >= sCurve.planned[index - 1])).toBe(true);
    const firstNull = sCurve.actual.indexOf(null);
    expect(firstNull).toBeGreaterThan(0);
    expect(sCurve.actual.slice(firstNull).every((value) => value === null)).toBe(true);
  });

  it('SITE_ENGINEER chỉ thấy số liệu của dự án được gán', async () => {
    const { kpis, costByProject } = await summaryFor('engineer');
    expect(kpis.totalProjects).toBe(3);
    expect(costByProject.map((cost) => cost.code).sort()).toEqual(['HCM-SGG', 'HN-CVMD', 'HN-GTHM']);
  });
});
