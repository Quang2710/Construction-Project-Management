import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  CHANGE_ORDER_STATUS_LABELS,
  ChangeOrderStatus,
  PAYMENT_STATUS_LABELS,
  PaymentStatus,
} from '../../models/cost.model';

/** Hai tập trạng thái không trùng giá trị nên dùng chung một chip. */
type CostStatus = ChangeOrderStatus | PaymentStatus;
type Tone = 'pending' | 'progress' | 'done' | 'danger' | 'neutral';

const CHIP: Readonly<Record<CostStatus, { readonly label: string; readonly icon: string; readonly tone: Tone }>> = {
  PROPOSED: { label: CHANGE_ORDER_STATUS_LABELS.PROPOSED, icon: 'hourglass_top', tone: 'pending' },
  APPROVED: { label: CHANGE_ORDER_STATUS_LABELS.APPROVED, icon: 'check_circle', tone: 'done' },
  REJECTED: { label: CHANGE_ORDER_STATUS_LABELS.REJECTED, icon: 'block', tone: 'danger' },
  PLANNED: { label: PAYMENT_STATUS_LABELS.PLANNED, icon: 'event', tone: 'neutral' },
  INVOICED: { label: PAYMENT_STATUS_LABELS.INVOICED, icon: 'request_quote', tone: 'progress' },
  PAID: { label: PAYMENT_STATUS_LABELS.PAID, icon: 'paid', tone: 'done' },
};

@Component({
  selector: 'app-cost-status-chip',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + tone()' },
  template: `<mat-icon>{{ chip().icon }}</mat-icon><span>{{ chip().label }}{{ overdue() ? ' · quá hạn' : '' }}</span>`,
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
export class CostStatusChipComponent {
  readonly status = input.required<CostStatus>();
  /** Đợt thanh toán đã đề nghị nhưng quá hạn chưa thu. */
  readonly overdue = input(false);

  protected readonly chip = computed(() => CHIP[this.status()]);
  protected readonly tone = computed<Tone>(() => (this.overdue() ? 'danger' : this.chip().tone));
}
