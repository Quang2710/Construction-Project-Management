import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { UserAvatarComponent } from '../../../../shared/ui/user-avatar/user-avatar.component';
import { parseIsoDate, todayIso, toIsoDate } from '../../../../shared/utils/date.utils';
import { TaskDialogStore } from '../../data-access/task-dialog.store';
import {
  Task,
  TASK_LABEL_SUGGESTIONS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
} from '../../models/task.model';
import { isTaskOverdue } from '../../utils/task.utils';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { toOptions } from '../../../../shared/utils/options';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { SliderModule } from 'primeng/slider';

export interface TaskDialogData {
  readonly task: Task | null;
  readonly projectId: string | null;
}

export type TaskDialogResult =
  | { readonly kind: 'saved'; readonly task: Task }
  | { readonly kind: 'deleted'; readonly taskId: string };

interface TaskForm {
  projectId: FormControl<string>;
  title: FormControl<string>;
  description: FormControl<string>;
  status: FormControl<TaskStatus>;
  priority: FormControl<TaskPriority>;
  assigneeId: FormControl<string | null>;
  startDate: FormControl<Date | null>;
  dueDate: FormControl<Date | null>;
  isMilestone: FormControl<boolean>;
  wbsId: FormControl<string | null>;
  percentComplete: FormControl<number>;
  labels: FormControl<string[]>;
}

const MAX_LABELS = 10;

/** Hạn hoàn thành ≥ ngày bắt đầu (đặt trên control dueDate). */
const dueAfterStart: ValidatorFn = (control: AbstractControl<Date | null>): ValidationErrors | null => {
  const start = (control.parent as FormGroup<TaskForm> | null)?.controls.startDate.value;
  const due = control.value;
  return start && due && due.getTime() < start.getTime() ? { dueBeforeStart: true } : null;
};

@Component({
  selector: 'app-task-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AutoCompleteModule,
    CheckboxModule,
    ChipModule,
    SliderModule,
    UserAvatarComponent,
    RelativeTimePipe,
    RoleLabelPipe,
    ButtonModule,
    IconComponent,
    ProgressSpinnerModule,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  providers: [TaskDialogStore],
  templateUrl: './task-dialog.component.html',
  styleUrl: './task-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDialogComponent {
  private readonly data = injectDialogData<TaskDialogData>();
  private readonly dialogRef = injectDialogRef<TaskDialogResult>();
  private readonly auth = inject(AuthStore);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  protected readonly store = inject(TaskDialogStore);

  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusOptions = toOptions(this.statuses, this.statusLabels);
  protected readonly priorities = TASK_PRIORITIES;
  protected readonly priorityLabels = TASK_PRIORITY_LABELS;
  protected readonly priorityOptions = toOptions(this.priorities, this.priorityLabels);

  protected readonly canEdit = computed(() => this.auth.hasAnyRole(PERMISSIONS.editTasks));
  protected readonly canDelete = computed(() => this.auth.hasAnyRole(PERMISSIONS.deleteTasks));
  protected readonly canComment = computed(() => this.auth.hasAnyRole(PERMISSIONS.commentTasks));

  protected readonly form = new FormGroup<TaskForm>({
    projectId: new FormControl(this.data.task?.projectId ?? this.data.projectId ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    title: new FormControl(this.data.task?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl(this.data.task?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
    status: new FormControl<TaskStatus>(this.data.task?.status ?? 'TODO', { nonNullable: true }),
    priority: new FormControl<TaskPriority>(this.data.task?.priority ?? 'MEDIUM', { nonNullable: true }),
    assigneeId: new FormControl<string | null>(this.data.task?.assigneeId ?? null),
    startDate: new FormControl<Date | null>(this.data.task ? parseIsoDate(this.data.task.startDate) : new Date(), {
      validators: [Validators.required],
    }),
    dueDate: new FormControl<Date | null>(this.data.task ? parseIsoDate(this.data.task.dueDate) : null, {
      validators: [Validators.required, dueAfterStart],
    }),
    isMilestone: new FormControl(this.data.task?.isMilestone ?? false, { nonNullable: true }),
    wbsId: new FormControl<string | null>(this.data.task?.wbsId ?? null),
    percentComplete: new FormControl(this.data.task?.percentComplete ?? 0, { nonNullable: true }),
    labels: new FormControl<string[]>([...(this.data.task?.labels ?? [])], { nonNullable: true }),
  });

  protected readonly commentControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  protected readonly labelInput = new FormControl('', { nonNullable: true });

  private readonly labels = toSignal(this.form.controls.labels.valueChanges, {
    initialValue: this.form.controls.labels.value,
  });
  /** Từ khoá người dùng gõ trong ô nhãn (AutoComplete báo qua completeMethod). */
  protected readonly labelQuery = signal('');
  protected readonly labelSuggestions = computed(() => {
    const chosen = new Set(this.labels());
    const query = this.labelQuery().trim().toLowerCase();
    return TASK_LABEL_SUGGESTIONS.filter((label) => !chosen.has(label) && label.toLowerCase().includes(query));
  });

  protected readonly isOverdue = computed(() => {
    const task = this.store.task();
    return task ? isTaskOverdue(task, todayIso()) : false;
  });

  /** Kết quả trả về khi đóng dialog mà không bấm Lưu (ví dụ sau khi thêm bình luận). */
  private readonly changedTask = signal<Task | null>(null);

  constructor() {
    void this.store.init(this.data.task, this.data.projectId);
    if (this.data.task) {
      this.form.controls.projectId.disable();
    }
    if (!this.canEdit()) {
      this.form.disable();
      this.labelInput.disable();
    }

    // Quy tắc nghiệp vụ: hoàn thành nghĩa là 100%.
    this.form.controls.status.valueChanges.pipe(takeUntilDestroyed()).subscribe((status) => {
      if (status === 'DONE') {
        this.form.controls.percentComplete.setValue(100);
      }
    });
    this.form.controls.projectId.valueChanges.pipe(takeUntilDestroyed()).subscribe((projectId) => {
      this.form.controls.assigneeId.setValue(null);
      this.form.controls.wbsId.setValue(null);
      if (projectId) {
        void this.store.loadMembers(projectId);
      }
    });
    this.form.controls.startDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      if (this.form.controls.isMilestone.value) {
        this.form.controls.dueDate.setValue(start);
      }
      this.form.controls.dueDate.updateValueAndValidity();
    });
    // Mốc tiến độ: thời lượng 0 → hạn = ngày bắt đầu.
    this.form.controls.isMilestone.valueChanges.pipe(takeUntilDestroyed()).subscribe((isMilestone) => {
      const due = this.form.controls.dueDate;
      if (isMilestone) {
        due.setValue(this.form.controls.startDate.value);
        due.disable();
      } else if (this.canEdit()) {
        due.enable();
      }
    });
    if (this.form.controls.isMilestone.value) {
      this.form.controls.dueDate.disable();
    }
  }

  pendingResult(): TaskDialogResult | undefined {
    const task = this.changedTask();
    return task ? { kind: 'saved', task } : undefined;
  }

  /** Enter hoặc dấu phẩy: thêm nhãn đang gõ (cho phép nhãn mới ngoài gợi ý). */
  protected onLabelKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    this.pushLabel(this.labelInput.value);
    this.labelInput.setValue('');
  }

  protected selectLabel(label: unknown): void {
    this.pushLabel(String(label));
    this.labelInput.setValue('');
  }

  protected removeLabel(label: string): void {
    const control = this.form.controls.labels;
    control.setValue(control.value.filter((item) => item !== label));
    control.markAsDirty();
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const fields = {
      title: value.title.trim(),
      description: value.description.trim(),
      status: value.status,
      priority: value.priority,
      assigneeId: value.assigneeId,
      startDate: value.startDate ? toIsoDate(value.startDate) : todayIso(),
      dueDate: value.dueDate ? toIsoDate(value.dueDate) : todayIso(),
      isMilestone: value.isMilestone,
      wbsId: value.wbsId,
      percentComplete: value.percentComplete,
      labels: value.labels,
    };
    const isEdit = this.store.isEdit();
    const saved = isEdit
      ? await this.store.update(fields)
      : await this.store.create({ ...fields, projectId: value.projectId });
    if (saved) {
      this.notification.success(isEdit ? 'Đã cập nhật công việc.' : 'Đã tạo công việc.');
      this.dialogRef.close({ kind: 'saved', task: saved });
    }
  }

  protected retryComments(): void {
    const task = this.store.task();
    if (task) {
      void this.store.loadComments(task.id);
    }
  }

  protected async remove(): Promise<void> {
    const task = this.store.task();
    if (!task) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Xoá công việc',
      message: `Xoá "${task.title}" cùng toàn bộ bình luận? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xoá',
      destructive: true,
    });
    if (confirmed && (await this.store.remove())) {
      this.notification.success('Đã xoá công việc.');
      this.dialogRef.close({ kind: 'deleted', taskId: task.id });
    }
  }

  protected async sendComment(): Promise<void> {
    const content = this.commentControl.value.trim();
    if (!content || this.store.sendingComment()) {
      return;
    }
    if (await this.store.addComment(content)) {
      this.commentControl.reset('');
      this.changedTask.set(this.store.task());
    }
  }

  private pushLabel(raw: string): void {
    const label = raw.trim();
    const control = this.form.controls.labels;
    if (!label || label.length > 30 || control.value.includes(label) || control.value.length >= MAX_LABELS) {
      return;
    }
    control.setValue([...control.value, label]);
    control.markAsDirty();
  }
}
