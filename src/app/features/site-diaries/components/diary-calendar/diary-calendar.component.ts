import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarCell } from '../../data-access/diary-calendar.store';
import { DIARY_STATUS_LABELS, SiteDiary } from '../../models/site-diary.model';
import { WEEKDAY_LABELS } from '../../utils/calendar.utils';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const MAX_VISIBLE = 3;

/** Lưới lịch tháng; mỗi ô liệt kê nhật ký trong ngày (mã dự án + trạng thái). */
@Component({
  selector: 'app-diary-calendar',
  imports: [
    IconComponent,
    TooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diary-calendar.component.html',
  styleUrl: './diary-calendar.component.scss',
})
export class DiaryCalendarComponent {
  readonly weeks = input.required<readonly (readonly CalendarCell[])[]>();
  readonly selectedDate = input<string | null>(null);

  readonly daySelect = output<string>();
  readonly diaryOpen = output<string>();

  protected readonly weekdays = WEEKDAY_LABELS;
  protected readonly maxVisible = MAX_VISIBLE;
  protected readonly statusLabels = DIARY_STATUS_LABELS;

  protected visible(diaries: readonly SiteDiary[]): readonly SiteDiary[] {
    return diaries.slice(0, MAX_VISIBLE);
  }

  protected openDiary(event: Event, id: string): void {
    event.stopPropagation();
    this.diaryOpen.emit(id);
  }
}
