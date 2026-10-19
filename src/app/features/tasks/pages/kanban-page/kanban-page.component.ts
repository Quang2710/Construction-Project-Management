import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { TaskDialogResult } from '../../components/task-dialog/task-dialog.component';
import { TaskDialogService } from '../../components/task-dialog/task-dialog.service';
import { KanbanStore } from '../../data-access/kanban.store';
import { Task, TASK_STATUS_LABELS, TASK_STATUSES, TaskStatus } from '../../models/task.model';

@Component({
  selector: 'app-kanban-page',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    HasRoleDirective,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TaskCardComponent,
  ],
  providers: [KanbanStore],
  templateUrl: './kanban-page.component.html',
  styleUrl: './kanban-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanPageComponent implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly taskDialog = inject(TaskDialogService);
  protected readonly store = inject(KanbanStore);

  /** ?projectId= từ link "Mở bảng Kanban" của trang chi tiết dự án. */
  readonly projectId = input<string>();

  protected readonly permissions = PERMISSIONS;
  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly canEdit = computed(() => this.auth.hasAnyRole(PERMISSIONS.editTasks));
  /** Trên cảm ứng phải giữ một chút mới kéo, để vẫn cuộn được bảng. */
  protected readonly dragDelay = { touch: 250, mouse: 0 };

  ngOnInit(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.store.setProject(projectId);
    }
  }

  protected onDrop(event: CdkDragDrop<TaskStatus, TaskStatus, Task>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    void this.store.moveTask(event.item.data.id, event.container.data, event.currentIndex);
  }

  protected isPending(taskId: string): boolean {
    return this.store.pendingIds().includes(taskId);
  }

  protected async openTask(task: Task): Promise<void> {
    this.applyResult(await this.taskDialog.open({ task }));
  }

  protected async createTask(): Promise<void> {
    this.applyResult(await this.taskDialog.open({ projectId: this.store.projectId() }));
  }

  private applyResult(result: TaskDialogResult | undefined): void {
    if (result?.kind === 'saved') {
      this.store.upsertTask(result.task);
    } else if (result?.kind === 'deleted') {
      this.store.removeTask(result.taskId);
    }
  }
}
