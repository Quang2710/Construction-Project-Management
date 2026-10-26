import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { UserAvatarComponent } from '../../../../shared/ui/user-avatar/user-avatar.component';
import { todayIso } from '../../../../shared/utils/date.utils';
import { Task } from '../../models/task.model';
import { isTaskOverdue } from '../../utils/task.utils';
import { TaskPriorityBadgeComponent } from '../task-priority-badge/task-priority-badge.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-task-card',
  imports: [
    DatePipe,
    UserAvatarComponent,
    TaskPriorityBadgeComponent,
    IconComponent,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'button',
    tabindex: '0',
    '[class.overdue]': 'overdue()',
    '[class.pending]': 'pending()',
    '[attr.aria-label]': 'task().title',
    '(click)': 'open.emit()',
    '(keydown.enter)': 'open.emit()',
  },
  template: `
    <div class="card__top">
      <span class="card__project">{{ task().project.code }}</span>
      <app-task-priority-badge [priority]="task().priority" />
    </div>
    <p class="card__title">
      @if (task().isMilestone) {
        <app-icon class="card__milestone" pTooltip="Mốc tiến độ" tooltipPosition="bottom">diamond</app-icon>
      }
      {{ task().title }}
    </p>

    @if (task().labels.length) {
      <div class="card__labels">
        @for (label of task().labels; track label) {
          <span class="label">{{ label }}</span>
        }
      </div>
    }

    <div class="progress" [attr.aria-label]="'Hoàn thành ' + task().percentComplete + '%'">
      <div class="progress__fill" [style.width.%]="task().percentComplete"></div>
    </div>

    <div class="card__bottom">
      <span class="due" [pTooltip]="overdue() ? 'Quá hạn' : 'Hạn hoàn thành'" tooltipPosition="bottom">
        <app-icon>{{ overdue() ? 'alarm' : 'event' }}</app-icon>
        {{ task().dueDate | date: 'dd/MM/yyyy' }}
      </span>
      <span class="card__meta">
        @if (task().commentCount) {
          <span class="comments" [pTooltip]="task().commentCount + ' bình luận'" tooltipPosition="bottom">
            <app-icon>chat_bubble</app-icon>{{ task().commentCount }}
          </span>
        }
        <span class="percent">{{ task().percentComplete }}%</span>
        @if (task().assignee; as assignee) {
          <app-user-avatar [name]="assignee.fullName" [size]="26" [pTooltip]="assignee.fullName" tooltipPosition="bottom" />
        }
      </span>
    </div>
  `,
  styleUrl: './task-card.component.scss',
})
export class TaskCardComponent {
  readonly task = input.required<Task>();
  /** Đang chờ BE xác nhận sau kéo thả. */
  readonly pending = input(false);
  readonly open = output<void>();

  protected readonly overdue = computed(() => isTaskOverdue(this.task(), todayIso()));
}
