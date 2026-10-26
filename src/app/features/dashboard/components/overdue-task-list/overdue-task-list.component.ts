import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { differenceInCalendarDays } from 'date-fns';
import { UserAvatarComponent } from '../../../../shared/ui/user-avatar/user-avatar.component';
import { parseIsoDate } from '../../../../shared/utils/date.utils';
import { TaskPriorityBadgeComponent } from '../../../tasks/components/task-priority-badge/task-priority-badge.component';
import { Task } from '../../../tasks/models/task.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface OverdueRow {
  readonly task: Task;
  readonly daysLate: number;
}

@Component({
  selector: 'app-overdue-task-list',
  imports: [
    DatePipe,
    UserAvatarComponent,
    TaskPriorityBadgeComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (row of rows(); track row.task.id) {
        <li>
          <button type="button" class="row" (click)="taskSelect.emit(row.task)">
            <app-icon class="row__icon" aria-hidden="true">alarm</app-icon>
            <span class="row__main">
              <span class="row__title">{{ row.task.title }}</span>
              <span class="row__sub">
                {{ row.task.project.code }} · hạn {{ row.task.dueDate | date: 'dd/MM/yyyy' }}
              </span>
            </span>
            <span class="row__late">Trễ {{ row.daysLate }} ngày</span>
            <app-task-priority-badge class="row__priority" [priority]="row.task.priority" />
            @if (row.task.assignee; as assignee) {
              <app-user-avatar [name]="assignee.fullName" [size]="28" [attr.title]="assignee.fullName" />
            }
          </button>
        </li>
      }
    </ul>
  `,
  styleUrl: './overdue-task-list.component.scss',
})
export class OverdueTaskListComponent {
  readonly tasks = input.required<readonly Task[]>();
  readonly taskSelect = output<Task>();

  protected readonly rows = computed<OverdueRow[]>(() => {
    const today = new Date();
    return this.tasks().map((task) => ({
      task,
      daysLate: Math.max(1, differenceInCalendarDays(today, parseIsoDate(task.dueDate))),
    }));
  });
}
