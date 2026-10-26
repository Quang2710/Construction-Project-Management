import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { NetworkStatusService } from '../../../../core/offline/network-status.service';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate, todayIso } from '../../../../shared/utils/date.utils';
import { DiaryCalendarComponent } from '../../components/diary-calendar/diary-calendar.component';
import { DiaryStatusChipComponent } from '../../components/diary-status-chip/diary-status-chip.component';
import { DiaryCalendarStore } from '../../data-access/diary-calendar.store';
import { DiaryOutboxService } from '../../data-access/diary-outbox.service';
import { DIARY_STATUS_LABELS, DIARY_STATUSES, DiaryStatus, WEATHER_ICONS, WEATHER_LABELS } from '../../models/site-diary.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

const ALL = 'ALL';

@Component({
  selector: 'app-diary-calendar-page',
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    SelectButtonModule,
    HasRoleDirective,
    PageHeaderComponent,
    ErrorStateComponent,
    DiaryCalendarComponent,
    DiaryStatusChipComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
    ...FIELD,
    SelectModule,
  ],
  providers: [DiaryCalendarStore],
  templateUrl: './diary-calendar-page.component.html',
  styleUrl: './diary-calendar-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryCalendarPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  protected readonly store = inject(DiaryCalendarStore);
  protected readonly outbox = inject(DiaryOutboxService);
  protected readonly network = inject(NetworkStatusService);

  /** ?projectId= khi mở từ trang chi tiết dự án. */
  readonly projectId = input<string>();

  protected readonly permissions = PERMISSIONS;
  protected readonly allValue = ALL;
  protected readonly statuses = DIARY_STATUSES;
  protected readonly statusLabels = DIARY_STATUS_LABELS;
  /** Bộ lọc trạng thái kèm số nhật ký trong tháng. */
  protected readonly statusFilterOptions = computed(() => [
    { label: 'Tất cả', value: ALL },
    ...this.store.statusCounts().map((item) => ({ label: `${DIARY_STATUS_LABELS[item.status]} (${item.count})`, value: item.status })),
  ]);
  protected readonly weatherIcons = WEATHER_ICONS;
  protected readonly weatherLabels = WEATHER_LABELS;
  protected readonly isClient = computed(() => this.auth.role() === 'CLIENT');

  protected readonly selectedDateValue = computed(() => parseIsoDate(this.store.selectedDate()));
  /** Chỉ cho lập nhật ký cho hôm nay hoặc ngày đã qua. */
  protected readonly canCreateForSelected = computed(() => this.store.selectedDate() <= todayIso());
  protected readonly selectedHasProjectDiary = computed(() => {
    const projectId = this.store.projectId();
    return projectId !== null && this.store.selectedDiaries().some((diary) => diary.projectId === projectId);
  });

  ngOnInit(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.store.setProject(projectId);
    }
  }

  protected onStatusChange(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    this.store.setStatus(typeof value === 'string' && value !== ALL ? (value as DiaryStatus) : null);
  }

  protected openDiary(id: string): void {
    void this.router.navigate(['/site-diaries', id]);
  }
}
