import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MATERIAL_REQUEST_STATUS_LABELS, MaterialRequestStatus } from '../../models/material.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const ICONS: Readonly<Record<MaterialRequestStatus, string>> = {
  PENDING: 'hourglass_top',
  APPROVED: 'local_shipping',
  REJECTED: 'block',
  RECEIVED: 'inventory',
};

@Component({
  selector: 'app-request-status-chip',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + status().toLowerCase()' },
  template: `<app-icon>{{ icon() }}</app-icon><span>{{ label() }}</span>`,
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
    :host(.chip--pending) {
      background: var(--app-tertiary-container);
      color: var(--app-on-tertiary-container);
    }
    :host(.chip--approved) {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.chip--received) {
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }
    :host(.chip--rejected) {
      background: var(--app-error-container);
      color: var(--app-on-error-container);
    }
  `,
})
export class RequestStatusChipComponent {
  readonly status = input.required<MaterialRequestStatus>();
  protected readonly label = computed(() => MATERIAL_REQUEST_STATUS_LABELS[this.status()]);
  protected readonly icon = computed(() => ICONS[this.status()]);
}
