import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { BreadcrumbService } from '../../../../core/layout/breadcrumb/breadcrumb.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { ApprovalTimelineComponent } from '../../components/approval-timeline/approval-timeline.component';
import { QualityDialogsService } from '../../components/quality-dialogs.service';
import { QualityStatusChipComponent } from '../../components/quality-status-chip/quality-status-chip.component';
import { InspectionDetailStore, InspectionHeader } from '../../data-access/inspection-detail.store';
import { InspectionDecision } from '../../data-access/quality-api.service';
import {
  CHECK_RESULT_LABELS,
  CheckResult,
  ChecklistItemInput,
  INSPECTION_ACTION_LABELS,
} from '../../models/quality.model';

@Component({
  selector: 'app-inspection-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    ErrorStateComponent,
    ApprovalTimelineComponent,
    QualityStatusChipComponent,
  ],
  providers: [InspectionDetailStore],
  templateUrl: './inspection-page.component.html',
  styleUrls: ['../detail.scss', './inspection-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionPageComponent implements HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly breadcrumbs = inject(BreadcrumbService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  private readonly dialogs = inject(QualityDialogsService);
  protected readonly store = inject(InspectionDetailStore);

  /** Tham số :id của route. */
  readonly id = input.required<string>();

  protected readonly resultLabels = CHECK_RESULT_LABELS;
  protected readonly actionLabels = INSPECTION_ACTION_LABELS;

  protected readonly header = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    inspectionDate: new FormControl<Date | null>(null, [Validators.required]),
  });

  protected readonly newCriterion = new FormGroup({
    criterion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)] }),
    requirement: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });

  protected readonly backQuery = computed(() => ({ projectId: this.store.inspection()?.projectId, tab: 'inspections' }));
  protected readonly history = computed(() => [...(this.store.inspection()?.history ?? [])].reverse());
  /** Ý kiến của lần trả lại gần nhất (hiển thị khi phiếu bị trả lại). */
  protected readonly rejection = computed(() => {
    const inspection = this.store.inspection();
    return inspection?.status === 'REJECTED' ? (inspection.approvals.find((step) => step.decision === 'REJECTED') ?? null) : null;
  });
  protected readonly counts = computed(() => {
    const items = this.store.items();
    return {
      pass: items.filter((item) => item.result === 'PASS').length,
      fail: items.filter((item) => item.result === 'FAIL').length,
      na: items.filter((item) => item.result === 'NA').length,
    };
  });
  /** Ghi nhận lỗi từ tiêu chí không đạt khi phiếu chưa nghiệm thu xong. */
  protected readonly canRaisePunch = computed(
    () => this.store.canCreatePunch() && this.store.inspection()?.status !== 'APPROVED' && this.store.members().length > 0,
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    // Đồng bộ form thông tin chung mỗi khi phiếu được tải / lưu lại.
    effect(() => {
      const inspection = this.store.inspection();
      if (!inspection) {
        return;
      }
      untracked(() => {
        this.header.reset({
          title: inspection.title,
          location: inspection.location,
          inspectionDate: parseIsoDate(inspection.inspectionDate),
        });
        if (this.store.canEdit()) {
          this.header.enable();
        } else {
          this.header.disable();
        }
        this.breadcrumbs.setLabel(`/quality/inspections/${inspection.id}`, `${inspection.project.code} · ${inspection.code}`);
      });
    });
  }

  hasUnsavedChanges(): boolean {
    return this.store.canEdit() && (this.store.dirty() || this.header.dirty);
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected onResult(index: number, event: MatButtonToggleChange): void {
    const value: unknown = event.value;
    this.store.setResult(index, value === 'PASS' || value === 'FAIL' || value === 'NA' ? (value as CheckResult) : null);
  }

  protected onNote(index: number, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.store.setNote(index, event.target.value);
    }
  }

  protected addCriterion(): void {
    if (this.newCriterion.invalid) {
      this.newCriterion.markAllAsTouched();
      return;
    }
    const value = this.newCriterion.getRawValue();
    this.store.addItem(value.criterion.trim(), value.requirement.trim());
    this.newCriterion.reset();
  }

  protected async save(): Promise<void> {
    const header = this.readHeader();
    if (header && (await this.store.save(header))) {
      this.header.markAsPristine();
    }
  }

  protected async submit(): Promise<void> {
    const header = this.readHeader();
    if (!header) {
      return;
    }
    if (this.store.pendingCount() > 0) {
      this.notification.error(`Còn ${this.store.pendingCount()} tiêu chí chưa đánh giá (Đạt / Không đạt / Không áp dụng).`);
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Gửi duyệt phiếu nghiệm thu',
      message:
        this.counts().fail > 0
          ? `Phiếu có ${this.counts().fail} tiêu chí không đạt. Người duyệt sẽ trả lại cho tới khi khắc phục xong. Vẫn gửi?`
          : 'Sau khi gửi, phiếu bị khoá chỉnh sửa và chuyển cho cấp duyệt đầu tiên.',
      confirmText: 'Gửi duyệt',
    });
    if (confirmed && (await this.store.submit(header))) {
      this.header.markAsPristine();
    }
  }

  protected async decide(decision: InspectionDecision): Promise<void> {
    const inspection = this.store.inspection();
    const level = this.store.currentLevel();
    if (!inspection || !level) {
      return;
    }
    const note = await this.dialogs.note({
      title: decision === 'approve' ? `Duyệt cấp ${level.level}` : 'Trả lại phiếu nghiệm thu',
      subtitle: `${inspection.code} · ${inspection.title}`,
      label: decision === 'approve' ? 'Ý kiến (không bắt buộc)' : 'Lý do trả lại',
      confirmText: decision === 'approve' ? 'Duyệt' : 'Trả lại',
      required: decision === 'reject',
      requiredMessage: 'Vui lòng nhập lý do để người lập biết cần khắc phục gì.',
      destructive: decision === 'reject',
    });
    if (note !== undefined) {
      await this.store.decide(decision, note);
    }
  }

  protected async remove(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Xoá phiếu nháp',
      message: 'Xoá phiếu nghiệm thu nháp này? Thao tác không thể hoàn tác.',
      confirmText: 'Xoá',
      destructive: true,
    });
    const projectId = this.store.inspection()?.projectId;
    if (confirmed && (await this.store.remove())) {
      await this.router.navigate(['/quality'], { queryParams: { projectId, tab: 'inspections' } });
    }
  }

  protected async raisePunch(item: ChecklistItemInput): Promise<void> {
    const inspection = this.store.inspection();
    if (!inspection || !item.id) {
      return;
    }
    const result = await this.dialogs.punchForm({
      projectCode: inspection.project.code,
      members: this.store.members(),
      prefill: {
        title: `${item.criterion} không đạt`,
        description: [item.requirement && `Yêu cầu: ${item.requirement}`, item.note].filter(Boolean).join('. '),
        location: inspection.location,
        checklistItemId: item.id,
        inspectionCode: inspection.code,
      },
    });
    if (result) {
      await this.store.createPunch(result.draft, result.files);
    }
  }

  private readHeader(): InspectionHeader | null {
    if (this.header.invalid) {
      this.header.markAllAsTouched();
      return null;
    }
    const value = this.header.getRawValue();
    return value.inspectionDate
      ? { title: value.title.trim(), location: value.location.trim(), inspectionDate: toIsoDate(value.inspectionDate) }
      : null;
  }
}
