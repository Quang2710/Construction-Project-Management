import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { UserAvatarComponent } from '../../../../shared/ui/user-avatar/user-avatar.component';
import { todayIso } from '../../../../shared/utils/date.utils';
import { ProjectTasksStore } from '../../data-access/project-tasks.store';
import { Task, TASK_STATUS_LABELS } from '../../models/task.model';
import { isTaskOverdue } from '../../utils/task.utils';
import { TaskDialogResult } from '../task-dialog/task-dialog.component';
import { TaskDialogService } from '../task-dialog/task-dialog.service';
import { TaskPriorityBadgeComponent } from '../task-priority-badge/task-priority-badge.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

/** Bảng công việc của một dự án, dùng trong tab "Công việc" của trang chi tiết dự án. */
@Component({
  selector: 'app-project-tasks-panel',
  imports: [
    DatePipe,
    RouterLink,
    HasRoleDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    UserAvatarComponent,
    TaskPriorityBadgeComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
  ],
  providers: [ProjectTasksStore],
  templateUrl: './project-tasks-panel.component.html',
  styleUrl: './project-tasks-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTasksPanelComponent {
  private readonly taskDialog = inject(TaskDialogService);
  protected readonly store = inject(ProjectTasksStore);

  readonly projectId = input.required<string>();
  /** Công việc thay đổi -> trang cha làm mới % tiến độ dự án. */
  readonly changed = output<void>();

  protected readonly permissions = PERMISSIONS;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly today = todayIso();

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      untracked(() => void this.store.load(projectId));
    });
  }

  protected isOverdue(task: Task): boolean {
    return isTaskOverdue(task, this.today);
  }

  protected reload(): void {
    void this.store.load(this.projectId());
  }

  protected async openTask(task: Task): Promise<void> {
    this.apply(await this.taskDialog.open({ task }));
  }

  protected async createTask(): Promise<void> {
    this.apply(await this.taskDialog.open({ projectId: this.projectId() }));
  }

  private apply(result: TaskDialogResult | undefined): void {
    if (result?.kind === 'saved') {
      this.store.upsert(result.task);
      this.changed.emit();
    } else if (result?.kind === 'deleted') {
      this.store.remove(result.taskId);
      this.changed.emit();
    }
  }
}
