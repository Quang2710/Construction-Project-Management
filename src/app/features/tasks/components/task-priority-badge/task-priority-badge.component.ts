import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TASK_PRIORITY_LABELS, TaskPriority } from '../../models/task.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const PRIORITY_ICONS: Readonly<Record<TaskPriority, string>> = {
  LOW: 'keyboard_arrow_down',
  MEDIUM: 'drag_handle',
  HIGH: 'keyboard_arrow_up',
  URGENT: 'priority_high',
};

@Component({
  selector: 'app-task-priority-badge',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"badge badge--" + priority().toLowerCase()', '[attr.title]': '"Ưu tiên: " + label()' },
  template: `<app-icon>{{ icon() }}</app-icon><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 8px 1px 4px;
      border-radius: 999px;
      font: var(--app-label-small);
      white-space: nowrap;
    }
    app-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.badge--low) {
      background: var(--app-surface-container-highest);
      color: var(--app-on-surface-variant);
    }
    :host(.badge--medium) {
      background: var(--app-secondary-container);
      color: var(--app-on-secondary-container);
    }
    :host(.badge--high) {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.badge--urgent) {
      background: var(--app-error-container);
      color: var(--app-on-error-container);
    }
  `,
})
export class TaskPriorityBadgeComponent {
  readonly priority = input.required<TaskPriority>();
  protected readonly label = computed(() => TASK_PRIORITY_LABELS[this.priority()]);
  protected readonly icon = computed(() => PRIORITY_ICONS[this.priority()]);
}
