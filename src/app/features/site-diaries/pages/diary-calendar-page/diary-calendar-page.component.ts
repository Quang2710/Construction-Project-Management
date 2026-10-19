import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate, todayIso } from '../../../../shared/utils/date.utils';
import { DiaryCalendarComponent } from '../../components/diary-calendar/diary-calendar.component';
import { DiaryStatusChipComponent } from '../../components/diary-status-chip/diary-status-chip.component';
import { DiaryCalendarStore } from '../../data-access/diary-calendar.store';
import { DIARY_STATUS_LABELS, DIARY_STATUSES, DiaryStatus, WEATHER_ICONS, WEATHER_LABELS } from '../../models/site-diary.model';

const ALL = 'ALL';

@Component({
  selector: 'app-diary-calendar-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    HasRoleDirective,
    PageHeaderComponent,
    ErrorStateComponent,
    DiaryCalendarComponent,
    DiaryStatusChipComponent,
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

  /** ?projectId= khi mở từ trang chi tiết dự án. */
  readonly projectId = input<string>();

  protected readonly permissions = PERMISSIONS;
  protected readonly allValue = ALL;
  protected readonly statuses = DIARY_STATUSES;
  protected readonly statusLabels = DIARY_STATUS_LABELS;
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

  protected onStatusChange(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    this.store.setStatus(typeof value === 'string' && value !== ALL ? (value as DiaryStatus) : null);
  }

  protected openDiary(id: string): void {
    void this.router.navigate(['/site-diaries', id]);
  }
}
