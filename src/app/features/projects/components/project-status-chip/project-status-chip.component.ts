import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROJECT_STATUS_LABELS, ProjectStatus } from '../../models/project.model';

@Component({
  selector: 'app-project-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"chip chip--" + status().toLowerCase()' },
  template: `{{ label() }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--app-label-medium);
      white-space: nowrap;
    }
    :host(.chip--planning) {
      background: var(--app-tertiary-container);
      color: var(--app-on-tertiary-container);
    }
    :host(.chip--in_progress) {
      background: var(--app-primary-container);
      color: var(--app-on-primary-container);
    }
    :host(.chip--on_hold) {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.chip--completed) {
      background: var(--app-success-container);
      color: var(--app-on-success-container);
    }
    :host(.chip--cancelled) {
      background: var(--app-surface-container-highest);
      color: var(--app-on-surface-variant);
    }
  `,
})
export class ProjectStatusChipComponent {
  readonly status = input.required<ProjectStatus>();
  protected readonly label = computed(() => PROJECT_STATUS_LABELS[this.status()]);
}
