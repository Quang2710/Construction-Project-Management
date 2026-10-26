import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CHANGE_ORDER_STATUS_LABELS,
  ChangeOrderStatus,
  PAYMENT_STATUS_LABELS,
  PaymentStatus,
} from '../../models/cost.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

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
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + tone()' },
  template: `<app-icon>{{ chip().icon }}</app-icon><span>{{ chip().label }}{{ overdue() ? ' · quá hạn' : '' }}</span>`,
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
export class CostStatusChipComponent {
  readonly status = input.required<CostStatus>();
  /** Đợt thanh toán đã đề nghị nhưng quá hạn chưa thu. */
  readonly overdue = input(false);

  protected readonly chip = computed(() => CHIP[this.status()]);
  protected readonly tone = computed<Tone>(() => (this.overdue() ? 'danger' : this.chip().tone));
}
