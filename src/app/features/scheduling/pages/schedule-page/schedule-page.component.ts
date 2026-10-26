import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, input, OnInit, viewChild } from '@angular/core';
import { AppDialog } from '../../../../shared/ui/dialog/app-dialog.service';
import {
  GanttBarClickEvent,
  GanttDragEvent,
  GanttLineClickEvent,
  GanttLinkDragEvent,
  GanttViewType,
  NgxGanttComponent,
  NgxGanttModule,
} from '@worktile/gantt';
import { firstValueFrom } from 'rxjs';
import { fromUnixTime } from 'date-fns';
import { ThemeService } from '../../../../core/theme/theme.service';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { loadStylesheet } from '../../../../shared/utils/lazy-stylesheet';
import { TaskDialogService } from '../../../tasks/components/task-dialog/task-dialog.service';
import { WbsDialogComponent, WbsDialogData } from '../../components/wbs-dialog/wbs-dialog.component';
import { ScheduleStore, ScheduleViewType } from '../../data-access/schedule.store';
import { WbsCreateRequest } from '../../models/wbs.model';
import { SCHEDULE_COLORS, ScheduleItem, ScheduleOrigin, scheduleOrigin } from '../../utils/gantt-items';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

const VIEW_TYPES: readonly { value: ScheduleViewType; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
];

function toDate(value: number | Date | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  return toIsoDate(value instanceof Date ? value : fromUnixTime(value));
}

@Component({
  selector: 'app-schedule-page',
  imports: [
    MutablePipe,
    FormsModule,
    DatePipe,
    NgxGanttModule,
    SelectButtonModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
    ...FIELD,
    SelectModule,
  ],
  providers: [ScheduleStore],
  templateUrl: './schedule-page.component.html',
  styleUrl: './schedule-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulePageComponent implements OnInit {
  private readonly dialog = inject(AppDialog);
  private readonly taskDialog = inject(TaskDialogService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);
  protected readonly store = inject(ScheduleStore);

  /** ?projectId= khi mở từ trang dự án. */
  readonly projectId = input<string>();

  private readonly gantt = viewChild<NgxGanttComponent>('gantt');

  protected readonly viewTypes = VIEW_TYPES;
  protected readonly colors = SCHEDULE_COLORS;
  protected readonly ganttViewType = computed(() => this.store.viewType() as GanttViewType);
  protected readonly finishDate = computed(() => {
    const finish = this.store.stats().finishDate;
    return finish ? parseIsoDate(finish) : null;
  });
  protected readonly lateFinish = computed(() => {
    const finish = this.store.stats().finishDate;
    const project = this.store.project();
    return finish !== null && project !== null && finish > project.endDate;
  });
  /** Màu nền/viền của Gantt theo theme sáng/tối. */
  protected readonly ganttStyles = computed(() => ({ defaultTheme: this.theme.mode() === 'dark' ? 'dark' : 'default' }));

  ngOnInit(): void {
    void loadStylesheet(this.document, 'gantt.css');
    void this.store.init(this.projectId() ?? null);
  }

  protected asOrigin(item: ScheduleItem): ScheduleOrigin | null {
    return scheduleOrigin(item);
  }

  protected scrollToToday(): void {
    this.gantt()?.scrollToToday();
  }

  protected onDragEnded(event: GanttDragEvent): void {
    const origin = scheduleOrigin(event.item);
    const start = toDate(event.item.start);
    const end = toDate(event.item.end);
    if (origin?.kind !== 'task' || !start || !end) {
      return;
    }
    void this.store.reschedule(origin.task.id, start, origin.task.isMilestone ? start : end);
  }

  protected onLinkDragEnded(event: GanttLinkDragEvent): void {
    if (scheduleOrigin(event.source)?.kind === 'task' && scheduleOrigin(event.target)?.kind === 'task' && event.target) {
      void this.store.addDependency(event.source.id, event.target.id);
    }
  }

  protected async onLineClick(event: GanttLineClickEvent): Promise<void> {
    if (!this.store.canEdit()) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Xoá liên kết phụ thuộc',
      message: `Bỏ phụ thuộc "${event.source.title}" → "${event.target.title}"?`,
      confirmText: 'Xoá liên kết',
      destructive: true,
    });
    if (confirmed) {
      await this.store.removeDependency(event.source.id, event.target.id);
    }
  }

  protected async onBarClick(event: GanttBarClickEvent): Promise<void> {
    const origin = scheduleOrigin(event.item);
    if (origin?.kind === 'task') {
      await this.openTask(origin.task.id);
    }
  }

  protected async openTask(taskId: string): Promise<void> {
    const task = this.store.tasks().find((item) => item.id === taskId);
    if (task && (await this.taskDialog.open({ task }))) {
      await this.store.loadSchedule();
    }
  }

  protected async createTask(): Promise<void> {
    if (await this.taskDialog.open({ projectId: this.store.projectId() })) {
      await this.store.loadSchedule();
    }
  }

  protected async createWbs(): Promise<void> {
    const ref = this.dialog.open<WbsDialogComponent, WbsDialogData, WbsCreateRequest>(WbsDialogComponent, {
      data: { nodes: this.store.wbs() },
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.store.createWbs(result.name, result.parentId);
    }
  }
}
