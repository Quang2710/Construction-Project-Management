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
  Material,
  MaterialRequest,
  MaterialRequestCreate,
  MaterialRequestStatus,
  MaterialUpsertRequest,
  StockItem,
  StockTransaction,
  StockTransactionType,
} from '../models/material.model';
import { MaterialRequestAction, MaterialsApiService } from './materials-api.service';

interface MaterialsState {
  readonly projects: Project[];
  readonly projectId: string | null;
  readonly catalog: Material[];
  readonly stock: StockItem[];
  readonly stockLoading: boolean;
  readonly stockError: string | null;
  readonly requests: MaterialRequest[];
  readonly requestsTotal: number;
  readonly requestsPage: number;
  readonly requestsStatus: MaterialRequestStatus | null;
  readonly requestsLoading: boolean;
  readonly requestsError: string | null;
  readonly transactions: StockTransaction[];
  readonly transactionsTotal: number;
  readonly transactionsPage: number;
  readonly transactionsType: StockTransactionType | null;
  readonly transactionsLoading: boolean;
  readonly transactionsError: string | null;
  readonly busy: boolean;
}

const PAGE_SIZE = 10;

const initialState: MaterialsState = {
  projects: [],
  projectId: null,
  catalog: [],
  stock: [],
  stockLoading: false,
  stockError: null,
  requests: [],
  requestsTotal: 0,
  requestsPage: 1,
  requestsStatus: null,
  requestsLoading: false,
  requestsError: null,
  transactions: [],
  transactionsTotal: 0,
  transactionsPage: 1,
  transactionsType: null,
  transactionsLoading: false,
  transactionsError: null,
  busy: false,
};

/** Store dùng chung cho trang Vật tư (tồn kho, phiếu yêu cầu, lịch sử, danh mục). */
export const MaterialsStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _api: inject(MaterialsApiService),
    _projectsApi: inject(ProjectsApiService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => ({
    pageSize: computed(() => PAGE_SIZE),
    project: computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null),
    lowStock: computed(() => store.stock().filter((item) => item.isLow)),
    stockValue: computed(() => store.stock().reduce((sum, item) => sum + item.value, 0)),
    canManage: computed(() => store._auth.hasAnyRole(PERMISSIONS.manageMaterials)),
    canHandle: computed(() => store._auth.hasAnyRole(PERMISSIONS.handleStock)),
    canApprove: computed(() => store._auth.hasAnyRole(PERMISSIONS.approveMaterialRequests)),
  })),
  withMethods((store) => {
    /** Chạy thao tác ghi: báo thành công / lỗi (lỗi 0/401/403 do interceptor báo). */
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

    async function loadStock(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      patchState(store, { stockLoading: true, stockError: null });
      try {
        patchState(store, { stock: await firstValueFrom(store._api.stock({ projectId })), stockLoading: false });
      } catch (error) {
        patchState(store, { stockLoading: false, stockError: toApiError(error).message });
      }
    }

    async function loadRequests(): Promise<void> {
      patchState(store, { requestsLoading: true, requestsError: null });
      try {
        const response = await firstValueFrom(
          store._api.requests({
            projectId: store.projectId(),
            status: store.requestsStatus(),
            page: store.requestsPage(),
            pageSize: PAGE_SIZE,
          }),
        );
        patchState(store, { requests: response.data, requestsTotal: response.total, requestsLoading: false });
      } catch (error) {
        patchState(store, { requestsLoading: false, requestsError: toApiError(error).message });
      }
    }

    async function loadTransactions(): Promise<void> {
      patchState(store, { transactionsLoading: true, transactionsError: null });
      try {
        const response = await firstValueFrom(
          store._api.transactions({
            projectId: store.projectId(),
            type: store.transactionsType(),
            page: store.transactionsPage(),
            pageSize: PAGE_SIZE,
          }),
        );
        patchState(store, { transactions: response.data, transactionsTotal: response.total, transactionsLoading: false });
      } catch (error) {
        patchState(store, { transactionsLoading: false, transactionsError: toApiError(error).message });
      }
    }

    async function loadCatalog(): Promise<void> {
      try {
        const response = await firstValueFrom(store._api.materials({ pageSize: 500 }));
        patchState(store, { catalog: response.data });
      } catch {
        patchState(store, { catalog: [] });
      }
    }

    return {
      loadStock,
      loadRequests,
      loadTransactions,
      loadCatalog,

      async init(preferredProjectId: string | null): Promise<void> {
        patchState(store, { stockLoading: true });
        try {
          const [projects] = await Promise.all([
            firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' })),
            loadCatalog(),
          ]);
          // Chỉ công trường đang có hoạt động kho.
          const active = projects.data.filter((project) => ['IN_PROGRESS', 'ON_HOLD', 'PLANNING'].includes(project.status));
          const projectId = active.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : (active.find((project) => project.status === 'IN_PROGRESS') ?? active[0])?.id ?? null;
          patchState(store, { projects: active, projectId });
          await loadStock();
        } catch (error) {
          patchState(store, { stockLoading: false, stockError: toApiError(error).message });
        }
      },

      async setProject(projectId: string): Promise<void> {
        patchState(store, { projectId, requestsPage: 1, transactionsPage: 1 });
        await Promise.all([loadStock(), loadRequests(), loadTransactions()]);
      },

      setRequestsFilter(status: MaterialRequestStatus | null, page = 1): Promise<void> {
        patchState(store, { requestsStatus: status, requestsPage: page });
        return loadRequests();
      },

      setTransactionsFilter(type: StockTransactionType | null, page = 1): Promise<void> {
        patchState(store, { transactionsType: type, transactionsPage: page });
        return loadTransactions();
      },

      async moveStock(type: StockTransactionType, materialId: string, quantity: number, note: string): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) {
          return false;
        }
        const material = store.catalog().find((item) => item.id === materialId);
        const label = type === 'IN' ? 'Đã nhập kho' : 'Đã xuất kho';
        const result = await mutate(
          store._api.createTransaction({ projectId, materialId, type, quantity, note }),
          `${label} ${quantity.toLocaleString('vi-VN')} ${material?.unit ?? ''} ${material?.name ?? ''}.`,
        );
        if (result) {
          await Promise.all([loadStock(), loadTransactions()]);
        }
        return result !== null;
      },

      async setMinQuantity(materialId: string, minQuantity: number): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) {
          return false;
        }
        const result = await mutate(store._api.setMinQuantity(projectId, materialId, minQuantity), 'Đã cập nhật mức tồn tối thiểu.');
        if (result) {
          await loadStock();
        }
        return result !== null;
      },

      async createRequest(body: Omit<MaterialRequestCreate, 'projectId'>): Promise<MaterialRequest | null> {
        const projectId = store.projectId();
        if (!projectId) {
          return null;
        }
        const result = await mutate(store._api.createRequest({ ...body, projectId }), 'Đã gửi phiếu yêu cầu vật tư.');
        if (result) {
          await loadRequests();
        }
        return result;
      },

      async actOnRequest(id: string, action: MaterialRequestAction, note: string): Promise<MaterialRequest | null> {
        const messages: Record<MaterialRequestAction, string> = {
          approve: 'Đã duyệt phiếu yêu cầu.',
          reject: 'Đã từ chối phiếu yêu cầu.',
          receive: 'Đã nhập kho theo phiếu.',
        };
        const result = await mutate(store._api.actOnRequest(id, action, note), messages[action]);
        if (result) {
          await Promise.all([loadRequests(), action === 'receive' ? loadStock() : Promise.resolve(), loadTransactions()]);
        }
        return result;
      },

      async saveMaterial(id: string | null, body: MaterialUpsertRequest): Promise<Material | null> {
        const request = id ? store._api.updateMaterial(id, body) : store._api.createMaterial(body);
        const result = await mutate(request, id ? 'Đã cập nhật vật tư.' : 'Đã thêm vật tư vào danh mục.');
        if (result) {
          await Promise.all([loadCatalog(), loadStock()]);
        }
        return result;
      },

      /** Tra cứu mã QR trong danh mục đã tải; nếu chưa có thì hỏi BE. */
      async lookupByCode(code: string): Promise<Material | null> {
        const normalized = code.trim().toUpperCase();
        const cached = store.catalog().find((material) => material.code === normalized);
        if (cached) {
          return cached;
        }
        try {
          return await firstValueFrom(store._api.materialByCode(normalized));
        } catch (error) {
          store._notification.error(toApiError(error).message);
          return null;
        }
      },
    };
  }),
);
