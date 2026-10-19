import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TASK_PRIORITY_LABELS, TaskPriority } from '../../models/task.model';

const PRIORITY_ICONS: Readonly<Record<TaskPriority, string>> = {
  LOW: 'keyboard_arrow_down',
  MEDIUM: 'drag_handle',
  HIGH: 'keyboard_arrow_up',
  URGENT: 'priority_high',
};

@Component({
  selector: 'app-task-priority-badge',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"badge badge--" + priority().toLowerCase()', '[attr.title]': '"Ưu tiên: " + label()' },
  template: `<mat-icon>{{ icon() }}</mat-icon><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 8px 1px 4px;
      border-radius: 999px;
      font: var(--mat-sys-label-small);
      white-space: nowrap;
    }
    mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    :host(.badge--low) {
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    :host(.badge--medium) {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    :host(.badge--high) {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    :host(.badge--urgent) {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class TaskPriorityBadgeComponent {
  readonly priority = input.required<TaskPriority>();
  protected readonly label = computed(() => TASK_PRIORITY_LABELS[this.priority()]);
  protected readonly icon = computed(() => PRIORITY_ICONS[this.priority()]);
}
