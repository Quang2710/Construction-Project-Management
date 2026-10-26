import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  INSPECTION_STATUS_LABELS,
  InspectionStatus,
  PUNCH_STATUS_LABELS,
  PunchStatus,
} from '../../models/quality.model';

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
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + chip().tone' },
  template: `<mat-icon>{{ chip().icon }}</mat-icon><span>{{ chip().label }}{{ suffix() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px 2px 6px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.chip--neutral) {
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    :host(.chip--pending) {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
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
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
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
