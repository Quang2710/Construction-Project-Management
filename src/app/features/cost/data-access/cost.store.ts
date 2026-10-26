import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import {
  ChangeOrder,
  ChangeOrderCreate,
  CostCategory,
  CostEntry,
  CostEntryCreate,
  CostSummary,
  PaymentMilestone,
  ProfitLossRow,
} from '../models/cost.model';
import { ChangeOrderDecision, CostApiService } from './cost-api.service';

const PAGE_SIZE = 15;
/** Đủ lớn để xuất toàn bộ chứng từ một dự án ra Excel. */
const EXPORT_PAGE_SIZE = 1000;

interface CostState {
  readonly projects: Project[];
  readonly projectId: string | null;
  readonly projectsLoading: boolean;
  readonly projectsError: string | null;
  readonly summary: CostSummary | null;
  readonly summaryLoading: boolean;
  readonly summaryError: string | null;
  readonly entries: CostEntry[];
  readonly entriesTotal: number;
  readonly entriesPage: number;
  readonly entriesCategory: CostCategory | null;
  readonly entriesQuery: string;
  readonly entriesLoading: boolean;
  readonly entriesError: string | null;
  readonly changeOrders: ChangeOrder[];
  readonly changeOrdersLoading: boolean;
  readonly changeOrdersError: string | null;
  readonly payments: PaymentMilestone[];
  readonly paymentsLoading: boolean;
  readonly paymentsError: string | null;
  readonly overview: ProfitLossRow[];
  readonly overviewLoading: boolean;
  readonly overviewError: string | null;
  readonly busy: boolean;
  readonly exporting: boolean;
}

const initialState: CostState = {
  projects: [],
  projectId: null,
  projectsLoading: false,
  projectsError: null,
  summary: null,
  summaryLoading: false,
  summaryError: null,
  entries: [],
  entriesTotal: 0,
  entriesPage: 1,
  entriesCategory: null,
  entriesQuery: '',
  entriesLoading: false,
  entriesError: null,
  changeOrders: [],
  changeOrdersLoading: false,
  changeOrdersError: null,
  payments: [],
  paymentsLoading: false,
  paymentsError: null,
  overview: [],
  overviewLoading: false,
  overviewError: null,
  busy: false,
  exporting: false,
};

/** Store trang Chi phí: tổng hợp, chứng từ, phát sinh, thanh toán của dự án đang chọn và lãi/lỗ toàn danh mục. */
export const CostStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _api: inject(CostApiService),
    _projectsApi: inject(ProjectsApiService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => ({
    pageSize: computed(() => PAGE_SIZE),
    project: computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null),
    /** Ghi chi phí, phát sinh, thanh toán và xem lãi/lỗ; CLIENT chỉ xem. */
    canManage: computed(() => store._auth.hasAnyRole(PERMISSIONS.manageCosts)),
    costItems: computed(() => store.summary()?.items ?? []),
    overrunItems: computed(() => (store.summary()?.items ?? []).filter((item) => item.overrun)),
    pendingChangeOrders: computed(() => store.changeOrders().filter((order) => order.status === 'PROPOSED')),
    overduePayments: computed(() => store.payments().filter((payment) => payment.isOverdue)),
    overviewTotals: computed(() =>
      store.overview().reduce(
        (totals, row) => ({
          contractValue: totals.contractValue + row.contractValue,
          actualCost: totals.actualCost + row.actualCost,
          received: totals.received + row.received,
          profitToDate: totals.profitToDate + (row.profitToDate ?? 0),
          forecastProfit: totals.forecastProfit + (row.forecastProfit ?? 0),
        }),
        { contractValue: 0, actualCost: 0, received: 0, profitToDate: 0, forecastProfit: 0 },
      ),
    ),
  })),
  withMethods((store) => {
    /** Thao tác ghi: báo thành công / lỗi (lỗi 0/401/403 do errorInterceptor báo). */
    async function mutate<T>(request: Observable<T>, success: string): Promise<T | null> {
      patchState(store, { busy: true });
      try {
        const result = await firstValueFrom(request);
        store._notification.success(success);
        return result;
      } catch (error) {
        if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
          store._notification.error(toApiError(error).message);
        }
        return null;
      } finally {
        patchState(store, { busy: false });
      }
    }

    /** Bỏ kết quả về muộn nếu người dùng đã chuyển dự án trong lúc tải. */
    function isCurrent(projectId: string): boolean {
      return store.projectId() === projectId;
    }

    async function loadSummary(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { summaryLoading: true, summaryError: null });
      try {
        const summary = await firstValueFrom(store._api.summary(projectId));
        if (isCurrent(projectId)) {
          patchState(store, { summary, summaryLoading: false });
        }
      } catch (error) {
        if (isCurrent(projectId)) {
          patchState(store, { summaryLoading: false, summaryError: toApiError(error).message });
        }
      }
    }

    async function loadEntries(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { entriesLoading: true, entriesError: null });
      try {
        const response = await firstValueFrom(
          store._api.entries(projectId, {
            category: store.entriesCategory(),
            q: store.entriesQuery().trim(),
            page: store.entriesPage(),
            pageSize: PAGE_SIZE,
            sort: '-date',
          }),
        );
        if (isCurrent(projectId)) {
          patchState(store, { entries: response.data, entriesTotal: response.total, entriesLoading: false });
        }
      } catch (error) {
        if (isCurrent(projectId)) {
          patchState(store, { entriesLoading: false, entriesError: toApiError(error).message });
        }
      }
    }

    async function loadChangeOrders(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { changeOrdersLoading: true, changeOrdersError: null });
      try {
        const changeOrders = await firstValueFrom(store._api.changeOrders(projectId));
        if (isCurrent(projectId)) {
          patchState(store, { changeOrders, changeOrdersLoading: false });
        }
      } catch (error) {
        if (isCurrent(projectId)) {
          patchState(store, { changeOrdersLoading: false, changeOrdersError: toApiError(error).message });
        }
      }
    }

    async function loadPayments(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { paymentsLoading: true, paymentsError: null });
      try {
        const payments = await firstValueFrom(store._api.payments(projectId));
        if (isCurrent(projectId)) {
          patchState(store, { payments, paymentsLoading: false });
        }
      } catch (error) {
        if (isCurrent(projectId)) {
          patchState(store, { paymentsLoading: false, paymentsError: toApiError(error).message });
        }
      }
    }

    function loadProject(): Promise<void> {
      return Promise.all([loadSummary(), loadEntries(), loadChangeOrders(), loadPayments()]).then(() => undefined);
    }

    return {
      loadSummary,
      loadEntries,
      loadChangeOrders,
      loadPayments,

      async init(preferredProjectId: string | null): Promise<void> {
        patchState(store, { projectsLoading: true, projectsError: null });
        try {
          const response = await firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' }));
          const projects = response.data.filter((project) => project.status !== 'CANCELLED');
          const fallback = projects.find((project) => project.status === 'IN_PROGRESS') ?? projects[0];
          const projectId = projects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : (fallback?.id ?? null);
          patchState(store, { projects, projectId, projectsLoading: false });
          await loadProject();
        } catch (error) {
          patchState(store, { projectsLoading: false, projectsError: toApiError(error).message });
        }
      },

      setProject(projectId: string): Promise<void> {
        patchState(store, {
          projectId,
          summary: null,
          entries: [],
          entriesTotal: 0,
          entriesPage: 1,
          changeOrders: [],
          payments: [],
        });
        return loadProject();
      },

      setEntriesFilter(filter: { category?: CostCategory | null; q?: string; page?: number }): Promise<void> {
        patchState(store, {
          entriesCategory: filter.category === undefined ? store.entriesCategory() : filter.category,
          entriesQuery: filter.q ?? store.entriesQuery(),
          // Đổi bộ lọc thì về trang 1.
          entriesPage: filter.page ?? 1,
        });
        return loadEntries();
      },

      async loadOverview(): Promise<void> {
        patchState(store, { overviewLoading: true, overviewError: null });
        try {
          patchState(store, { overview: await firstValueFrom(store._api.overview()), overviewLoading: false });
        } catch (error) {
          patchState(store, { overviewLoading: false, overviewError: toApiError(error).message });
        }
      },

      async addEntry(body: CostEntryCreate): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) {
          return false;
        }
        const created = await mutate(store._api.createEntry(projectId, body), 'Đã ghi nhận chi phí.');
        if (created) {
          await Promise.all([loadSummary(), loadEntries()]);
        }
        return created !== null;
      },

      async proposeChangeOrder(body: ChangeOrderCreate): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) {
          return false;
        }
        const created = await mutate(store._api.createChangeOrder(projectId, body), `Đã lập phát sinh "${body.title}".`);
        if (created) {
          await loadChangeOrders();
        }
        return created !== null;
      },

      async decideChangeOrder(id: string, decision: ChangeOrderDecision, note: string): Promise<boolean> {
        const updated = await mutate(
          store._api.decideChangeOrder(id, decision, note),
          decision === 'approve' ? 'Đã chấp thuận phát sinh, dự toán đã được cập nhật.' : 'Đã ghi nhận không chấp thuận.',
        );
        if (updated) {
          // Chấp thuận làm thay đổi dự toán hạng mục và giá trị hợp đồng.
          await Promise.all([loadChangeOrders(), loadSummary()]);
        }
        return updated !== null;
      },

      async invoicePayment(payment: PaymentMilestone): Promise<boolean> {
        const updated = await mutate(store._api.updatePayment(payment.id, { status: 'INVOICED' }), `Đã đề nghị thanh toán ${payment.name}.`);
        if (updated) {
          await Promise.all([loadPayments(), loadSummary()]);
        }
        return updated !== null;
      },

      async markPaid(payment: PaymentMilestone, paidAmount: number): Promise<boolean> {
        const updated = await mutate(
          store._api.updatePayment(payment.id, { status: 'PAID', paidAmount }),
          `Đã ghi nhận thu tiền ${payment.name}.`,
        );
        if (updated) {
          await Promise.all([loadPayments(), loadSummary()]);
        }
        return updated !== null;
      },

      /** Xuất Excel dự án đang chọn: tải toàn bộ chứng từ (không theo trang/bộ lọc đang xem). */
      async exportProject(): Promise<void> {
        const projectId = store.projectId();
        const summary = store.summary();
        if (!projectId || !summary || store.exporting()) {
          return;
        }
        patchState(store, { exporting: true });
        try {
          const [entries, changeOrders, payments, excel] = await Promise.all([
            firstValueFrom(store._api.entries(projectId, { pageSize: EXPORT_PAGE_SIZE, sort: 'date' })),
            firstValueFrom(store._api.changeOrders(projectId)),
            firstValueFrom(store._api.payments(projectId)),
            // Tải lười: SheetJS chỉ nạp khi cần xuất.
            import('../utils/cost-excel'),
          ]);
          excel.exportProjectCostExcel({ summary, entries: entries.data, changeOrders, payments });
        } catch {
          store._notification.error('Không xuất được file Excel. Vui lòng thử lại.');
        } finally {
          patchState(store, { exporting: false });
        }
      },

      async exportProfitLoss(): Promise<void> {
        if (store.exporting() || store.overview().length === 0) {
          return;
        }
        patchState(store, { exporting: true });
        try {
          const excel = await import('../utils/cost-excel');
          excel.exportProfitLossExcel(store.overview());
        } catch {
          store._notification.error('Không xuất được file Excel. Vui lòng thử lại.');
        } finally {
          patchState(store, { exporting: false });
        }
      },
    };
  }),
);
