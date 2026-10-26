import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  INSPECTION_STATUS_LABELS,
  InspectionStatus,
  PUNCH_STATUS_LABELS,
  PunchStatus,
} from '../../models/quality.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

/** Hai tập trạng thái (phiếu nghiệm thu, punch item) không trùng giá trị nên dùng chung một chip. */
type QualityStatus = InspectionStatus | PunchStatus;
type Tone = 'neutral' | 'pending' | 'progress' | 'done' | 'danger';

const CHIP: Readonly<Record<QualityStatus, { readonly label: string; readonly icon: string; readonly tone: Tone }>> = {
  DRAFT: { label: INSPECTION_STATUS_LABELS.DRAFT, icon: 'edit_note', tone: 'neutral' },
  IN_REVIEW: { label: INSPECTION_STATUS_LABELS.IN_REVIEW, icon: 'hourglass_top', tone: 'pending' },
  APPROVED: { label: INSPECTION_STATUS_LABELS.APPROVED, icon: 'verified', tone: 'done' },
  REJECTED: { label: INSPECTION_STATUS_LABELS.REJECTED, icon: 'block', tone: 'danger' },
  OPEN: { label: PUNCH_STATUS_LABELS.OPEN, icon: 'report', tone: 'danger' },
  IN_PROGRESS: { label: PUNCH_STATUS_LABELS.IN_PROGRESS, icon: 'construction', tone: 'progress' },
  RESOLVED: { label: PUNCH_STATUS_LABELS.RESOLVED, icon: 'rule', tone: 'pending' },
  VERIFIED: { label: PUNCH_STATUS_LABELS.VERIFIED, icon: 'task_alt', tone: 'done' },
};

@Component({
  selector: 'app-quality-status-chip',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + chip().tone' },
  template: `<app-icon>{{ chip().icon }}</app-icon><span>{{ chip().label }}{{ suffix() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 999px;
      font: var(--app-label-medium);
      white-space: nowrap;
    }
    app-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.chip--neutral) {
      background: var(--app-surface-container-high);
      color: var(--app-on-surface-variant);
    }
    :host(.chip--pending) {
      background: var(--app-tertiary-container);
      color: var(--app-on-tertiary-container);
    }
    :host(.chip--progress) {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.chip--done) {
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }
    :host(.chip--danger) {
      background: var(--app-error-container);
      color: var(--app-on-error-container);
    }
  `,
})
export class QualityStatusChipComponent {
  readonly status = input.required<QualityStatus>();
  /** Cấp đang chờ duyệt (IN_REVIEW). */
  readonly level = input<number | null>(null);

  protected readonly chip = computed(() => CHIP[this.status()]);
  protected readonly suffix = computed(() => (this.status() === 'IN_REVIEW' && this.level() ? ` · cấp ${this.level()}` : ''));
}
