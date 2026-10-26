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
import {
  CheckResult,
  ChecklistItemInput,
  EDITABLE_INSPECTION_STATUSES,
  Inspection,
  INSPECTION_APPROVAL_LEVELS,
  PunchItem,
} from '../models/quality.model';
import { InspectionDecision, QualityApiService } from './quality-api.service';
import { PunchDraft } from './quality.store';

export interface InspectionHeader {
  readonly title: string;
  readonly location: string;
  readonly inspectionDate: string;
}

interface InspectionDetailState {
  readonly inspection: Inspection | null;
  /** Bản nháp checklist đang sửa (chỉ khi được sửa). */
  readonly items: ChecklistItemInput[];
  readonly dirty: boolean;
  readonly punchItems: PunchItem[];
  readonly members: UserSummary[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly busy: boolean;
}

function toInputs(inspection: Inspection): ChecklistItemInput[] {
  return inspection.items.map((item) => ({ ...item }));
}

export const InspectionDetailStore = signalStore(
  withState<InspectionDetailState>({
    inspection: null,
    items: [],
    dirty: false,
    punchItems: [],
    members: [],
    loading: false,
    error: null,
    busy: false,
  }),
  withProps(() => ({
    _api: inject(QualityApiService),
    _projectsApi: inject(ProjectsApiService),
    _photos: inject(PhotoUploadService),
    _notification: inject(NotificationService),
    _auth: inject(AuthStore),
  })),
  withComputed((store) => {
    const userId = computed(() => store._auth.user()?.id ?? null);
    const level = computed(
      () => INSPECTION_APPROVAL_LEVELS.find((config) => config.level === store.inspection()?.currentLevel) ?? null,
    );
    const failed = computed(() => store.items().filter((item) => item.result === 'FAIL').length);
    const openPunch = computed(() => store.punchItems().filter((item) => item.status !== 'VERIFIED').length);

    return {
      currentLevel: level,
      canEdit: computed(() => {
        const inspection = store.inspection();
        return !!inspection && EDITABLE_INSPECTION_STATUSES.includes(inspection.status) && store._auth.hasAnyRole(PERMISSIONS.editQuality);
      }),
      canCreatePunch: computed(() => store._auth.hasAnyRole(PERMISSIONS.editQuality)),
      /** Giống luật của BE: đúng role cấp hiện tại, không phải người lập, chưa duyệt cấp trước. */
      canDecide: computed(() => {
        const inspection = store.inspection();
        const current = level();
        const role = store._auth.role();
        return (
          !!inspection &&
          inspection.status === 'IN_REVIEW' &&
          !!current &&
          !!role &&
          current.roles.includes(role) &&
          inspection.createdBy.id !== userId() &&
          !inspection.approvals.some((approval) => approval.by?.id === userId())
        );
      }),
      pendingCount: computed(() => store.items().filter((item) => item.result === null).length),
      failedCount: failed,
      openPunchCount: openPunch,
      /** Lý do chưa duyệt được (hiển thị thay vì để BE trả 409). */
      approvalBlocker: computed(() => {
        if (failed() > 0) {
          return `Còn ${failed()} tiêu chí không đạt — hãy trả lại để khắc phục.`;
        }
        if (openPunch() > 0) {
          return `Còn ${openPunch()} lỗi trong punch list chưa được xác nhận đóng.`;
        }
        return null;
      }),
      /** Punch item theo tiêu chí, để hiện ngay dưới tiêu chí không đạt. */
      punchByItem: computed(() => {
        const map = new Map<string, PunchItem[]>();
        for (const punch of store.punchItems()) {
          if (punch.checklistItemId) {
            map.set(punch.checklistItemId, [...(map.get(punch.checklistItemId) ?? []), punch]);
          }
        }
        return map;
      }),
    };
  }),
  withMethods((store) => {
    function notifyError(error: unknown): void {
      if (!(error instanceof HttpErrorResponse && [0, 401, 403].includes(error.status))) {
        store._notification.error(toApiError(error).message);
      }
    }

    function apply(inspection: Inspection): void {
      patchState(store, { inspection, items: toInputs(inspection), dirty: false });
    }

    async function loadPunchItems(inspectionId: string): Promise<void> {
      const response = await firstValueFrom(store._api.punchItems({ inspectionId, pageSize: 100, sort: 'createdAt' }));
      patchState(store, { punchItems: response.data });
    }

    function updateItem(index: number, changes: Partial<ChecklistItemInput>): void {
      patchState(store, {
        items: store.items().map((item, i) => (i === index ? { ...item, ...changes } : item)),
        dirty: true,
      });
    }

    async function save(header: InspectionHeader, silent = false): Promise<boolean> {
      const inspection = store.inspection();
      if (!inspection) {
        return false;
      }
      patchState(store, { busy: true });
      try {
        apply(await firstValueFrom(store._api.updateInspection(inspection.id, { ...header, items: store.items() })));
        if (!silent) {
          store._notification.success('Đã lưu checklist.');
        }
        return true;
      } catch (error) {
        notifyError(error);
        return false;
      } finally {
        patchState(store, { busy: false });
      }
    }

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const inspection = await firstValueFrom(store._api.inspection(id));
          apply(inspection);
          await loadPunchItems(id);
          patchState(store, { loading: false });
          // Thành viên dự án cho form ghi nhận lỗi (không chặn trang khi lỗi).
          firstValueFrom(store._projectsApi.members(inspection.projectId))
            .then((members) => patchState(store, { members }))
            .catch(() => undefined);
        } catch (error) {
          patchState(store, { loading: false, error: toApiError(error).message });
        }
      },

      setResult(index: number, result: CheckResult | null): void {
        updateItem(index, { result });
      },

      setNote(index: number, note: string): void {
        updateItem(index, { note });
      },

      addItem(criterion: string, requirement: string): void {
        patchState(store, {
          items: [...store.items(), { id: null, criterion, requirement, result: null, note: '' }],
          dirty: true,
        });
      },

      removeItem(index: number): void {
        patchState(store, { items: store.items().filter((_, i) => i !== index), dirty: true });
      },

      /** Đánh dấu "Đạt" cho mọi tiêu chí chưa đánh giá. */
      passRemaining(): void {
        patchState(store, {
          items: store.items().map((item) => (item.result === null ? { ...item, result: 'PASS' as const } : item)),
          dirty: true,
        });
      },

      save,

      /** Lưu (nếu có thay đổi) rồi gửi duyệt. */
      async submit(header: InspectionHeader): Promise<boolean> {
        const inspection = store.inspection();
        if (!inspection || (store.dirty() && !(await save(header, true)))) {
          return false;
        }
        patchState(store, { busy: true });
        try {
          apply(await firstValueFrom(store._api.submitInspection(inspection.id)));
          store._notification.success('Đã gửi duyệt phiếu nghiệm thu.');
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        } finally {
          patchState(store, { busy: false });
        }
      },

      async decide(decision: InspectionDecision, note: string): Promise<boolean> {
        const inspection = store.inspection();
        if (!inspection) {
          return false;
        }
        patchState(store, { busy: true });
        try {
          const updated = await firstValueFrom(store._api.decideInspection(inspection.id, decision, note));
          apply(updated);
          store._notification.success(
            decision === 'reject'
              ? 'Đã trả lại phiếu cho người lập.'
              : updated.status === 'APPROVED'
                ? 'Phiếu đã được nghiệm thu.'
                : 'Đã duyệt, chuyển cấp tiếp theo.',
          );
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        } finally {
          patchState(store, { busy: false });
        }
      },

      async remove(): Promise<boolean> {
        const inspection = store.inspection();
        if (!inspection) {
          return false;
        }
        patchState(store, { busy: true });
        try {
          await firstValueFrom(store._api.deleteInspection(inspection.id));
          store._notification.success('Đã xoá phiếu nháp.');
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        } finally {
          patchState(store, { busy: false });
        }
      },

      /** Ghi nhận lỗi từ một tiêu chí không đạt. */
      async createPunch(draft: PunchDraft, files: readonly File[]): Promise<boolean> {
        const inspection = store.inspection();
        if (!inspection) {
          return false;
        }
        patchState(store, { busy: true });
        try {
          const beforePhotos = await store._photos.uploadAll(files, `Hiện trạng: ${draft.title}`);
          const created = await firstValueFrom(
            store._api.createPunchItem({ ...draft, projectId: inspection.projectId, inspectionId: inspection.id, beforePhotos }),
          );
          store._notification.success(`Đã ghi nhận ${created.code}.`);
          await loadPunchItems(inspection.id);
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        } finally {
          patchState(store, { busy: false });
        }
      },
    };
  }),
);
