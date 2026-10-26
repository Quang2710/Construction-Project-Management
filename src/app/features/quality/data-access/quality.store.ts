import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PhotoUploadService } from '../../../shared/data-access/photo-upload.service';
import { UserSummary } from '../../../shared/models/user.model';
import { toApiError } from '../../../shared/utils/api-error';
import { ProjectsApiService } from '../../projects/data-access/projects-api.service';
import { Project } from '../../projects/models/project.model';
import { SchedulingApiService } from '../../scheduling/data-access/scheduling-api.service';
import { WbsNode } from '../../scheduling/models/wbs.model';
import {
  ChecklistTemplate,
  Inspection,
  InspectionCreateRequest,
  InspectionStatus,
  PunchCreateRequest,
  PunchItem,
  PunchSeverity,
  PunchStatus,
} from '../models/quality.model';
import { QualityApiService } from './quality-api.service';

const PAGE_SIZE = 12;

export interface InspectionFilter {
  readonly status: InspectionStatus | null;
  readonly awaitingMe: boolean;
  readonly q: string;
  readonly page: number;
}

export interface PunchFilter {
  readonly status: PunchStatus | null;
  readonly severity: PunchSeverity | null;
  readonly mine: boolean;
  readonly overdue: boolean;
  readonly q: string;
  readonly page: number;
}

/** Thông tin nhập trong form ghi nhận lỗi; ảnh hiện trạng là File, store tự tải lên. */
export type PunchDraft = Omit<PunchCreateRequest, 'projectId' | 'beforePhotos'>;

interface QualityState {
  readonly projects: Project[];
  readonly projectId: string | null;
  readonly projectsLoading: boolean;
  readonly projectsError: string | null;
  readonly templates: ChecklistTemplate[];
  readonly wbs: WbsNode[];
  readonly members: UserSummary[];
  readonly inspections: Inspection[];
  readonly inspectionsTotal: number;
  readonly inspectionFilter: InspectionFilter;
  readonly inspectionsLoading: boolean;
  readonly inspectionsError: string | null;
  /** Số phiếu đang chờ người dùng hiện tại duyệt (badge). */
  readonly awaitingCount: number;
  readonly punchItems: PunchItem[];
  readonly punchTotal: number;
  readonly punchFilter: PunchFilter;
  readonly punchLoading: boolean;
  readonly punchError: string | null;
  readonly overdueCount: number;
  readonly busy: boolean;
}

const initialState: QualityState = {
  projects: [],
  projectId: null,
  projectsLoading: false,
  projectsError: null,
  templates: [],
  wbs: [],
  members: [],
  inspections: [],
  inspectionsTotal: 0,
  inspectionFilter: { status: null, awaitingMe: false, q: '', page: 1 },
  inspectionsLoading: false,
  inspectionsError: null,
  awaitingCount: 0,
  punchItems: [],
  punchTotal: 0,
  punchFilter: { status: null, severity: null, mine: false, overdue: false, q: '', page: 1 },
  punchLoading: false,
  punchError: null,
  overdueCount: 0,
  busy: false,
};

/** Store trang Chất lượng: danh sách phiếu nghiệm thu và punch list của dự án đang chọn. */
export const QualityStore = signalStore(
  withState(initialState),
  withProps(() => ({
    _api: inject(QualityApiService),
    _projectsApi: inject(ProjectsApiService),
    _schedulingApi: inject(SchedulingApiService),
    _photos: inject(PhotoUploadService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => ({
    pageSize: computed(() => PAGE_SIZE),
    project: computed(() => store.projects().find((project) => project.id === store.projectId()) ?? null),
    canEdit: computed(() => store._auth.hasAnyRole(PERMISSIONS.editQuality)),
  })),
  withMethods((store) => {
    function notifyError(error: unknown): void {
      // 0/401/403 đã được errorInterceptor thông báo.
      if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
        store._notification.error(toApiError(error).message);
      }
    }

    async function loadInspections(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      const filter = store.inspectionFilter();
      patchState(store, { inspectionsLoading: true, inspectionsError: null });
      try {
        const [response, awaiting] = await Promise.all([
          firstValueFrom(
            store._api.inspections({
              projectId,
              status: filter.status,
              awaitingMe: filter.awaitingMe || null,
              q: filter.q.trim(),
              page: filter.page,
              pageSize: PAGE_SIZE,
            }),
          ),
          firstValueFrom(store._api.inspections({ projectId, awaitingMe: true, pageSize: 1 })),
        ]);
        if (store.projectId() === projectId) {
          patchState(store, {
            inspections: response.data,
            inspectionsTotal: response.total,
            awaitingCount: awaiting.total,
            inspectionsLoading: false,
          });
        }
      } catch (error) {
        if (store.projectId() === projectId) {
          patchState(store, { inspectionsLoading: false, inspectionsError: toApiError(error).message });
        }
      }
    }

    async function loadPunchItems(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return;
      }
      const filter = store.punchFilter();
      patchState(store, { punchLoading: true, punchError: null });
      try {
        const [response, overdue] = await Promise.all([
          firstValueFrom(
            store._api.punchItems({
              projectId,
              status: filter.status,
              severity: filter.severity,
              assigneeId: filter.mine ? 'me' : null,
              overdue: filter.overdue || null,
              q: filter.q.trim(),
              page: filter.page,
              pageSize: PAGE_SIZE,
              sort: 'dueDate',
            }),
          ),
          firstValueFrom(store._api.punchItems({ projectId, overdue: true, pageSize: 1 })),
        ]);
        if (store.projectId() === projectId) {
          patchState(store, { punchItems: response.data, punchTotal: response.total, overdueCount: overdue.total, punchLoading: false });
        }
      } catch (error) {
        if (store.projectId() === projectId) {
          patchState(store, { punchLoading: false, punchError: toApiError(error).message });
        }
      }
    }

    /** WBS + thành viên cho các form tạo mới; lỗi ở đây không chặn trang. */
    async function loadProjectRefs(projectId: string): Promise<void> {
      try {
        const [wbs, members] = await Promise.all([
          firstValueFrom(store._schedulingApi.wbs(projectId)),
          firstValueFrom(store._projectsApi.members(projectId)),
        ]);
        if (store.projectId() === projectId) {
          patchState(store, { wbs, members });
        }
      } catch {
        // Form tạo mới sẽ hiển thị danh sách rỗng.
      }
    }

    function loadProject(): Promise<void> {
      const projectId = store.projectId();
      if (!projectId) {
        return Promise.resolve();
      }
      return Promise.all([loadInspections(), loadPunchItems(), loadProjectRefs(projectId)]).then(() => undefined);
    }

    return {
      loadInspections,
      loadPunchItems,

      async init(preferredProjectId: string | null): Promise<void> {
        patchState(store, { projectsLoading: true, projectsError: null });
        try {
          const [response, templates] = await Promise.all([
            firstValueFrom(store._projectsApi.list({ pageSize: 100, sort: 'code' })),
            firstValueFrom(store._api.templates()),
          ]);
          const projects = response.data.filter((project) => project.status !== 'CANCELLED' && project.status !== 'PLANNING');
          const fallback = projects.find((project) => project.status === 'IN_PROGRESS') ?? projects[0];
          const projectId = projects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : (fallback?.id ?? null);
          patchState(store, { projects, templates, projectId, projectsLoading: false });
          await loadProject();
        } catch (error) {
          patchState(store, { projectsLoading: false, projectsError: toApiError(error).message });
        }
      },

      setProject(projectId: string): Promise<void> {
        patchState(store, {
          projectId,
          inspections: [],
          punchItems: [],
          wbs: [],
          members: [],
          inspectionFilter: { ...store.inspectionFilter(), page: 1 },
          punchFilter: { ...store.punchFilter(), page: 1 },
        });
        return loadProject();
      },

      /** Đổi bộ lọc thì về trang 1 (trừ khi chỉ đổi trang). */
      setInspectionFilter(changes: Partial<InspectionFilter>): Promise<void> {
        patchState(store, { inspectionFilter: { ...store.inspectionFilter(), page: 1, ...changes } });
        return loadInspections();
      },

      setPunchFilter(changes: Partial<PunchFilter>): Promise<void> {
        patchState(store, { punchFilter: { ...store.punchFilter(), page: 1, ...changes } });
        return loadPunchItems();
      },

      async createInspection(body: Omit<InspectionCreateRequest, 'projectId'>): Promise<Inspection | null> {
        const projectId = store.projectId();
        if (!projectId) {
          return null;
        }
        patchState(store, { busy: true });
        try {
          const created = await firstValueFrom(store._api.createInspection({ ...body, projectId }));
          store._notification.success(`Đã lập phiếu ${created.code}. Hãy đánh giá từng tiêu chí.`);
          return created;
        } catch (error) {
          notifyError(error);
          return null;
        } finally {
          patchState(store, { busy: false });
        }
      },

      async createPunchItem(draft: PunchDraft, files: readonly File[]): Promise<PunchItem | null> {
        const projectId = store.projectId();
        if (!projectId) {
          return null;
        }
        patchState(store, { busy: true });
        try {
          const beforePhotos = await store._photos.uploadAll(files, `Hiện trạng: ${draft.title}`);
          const created = await firstValueFrom(store._api.createPunchItem({ ...draft, projectId, beforePhotos }));
          store._notification.success(`Đã ghi nhận ${created.code} và giao cho ${created.assignee?.fullName ?? 'người xử lý'}.`);
          await loadPunchItems();
          return created;
        } catch (error) {
          notifyError(error);
          return null;
        } finally {
          patchState(store, { busy: false });
        }
      },
    };
  }),
);
