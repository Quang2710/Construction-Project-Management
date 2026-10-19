import { addDays, endOfMonth, endOfWeek, format, isSunday, startOfMonth, startOfWeek } from 'date-fns';
import { toIsoDate } from '../../../shared/utils/date.utils';

export interface CalendarDay {
  /** yyyy-MM-dd */
  readonly date: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  /** Chủ nhật — công trường thường nghỉ. */
  readonly isSunday: boolean;
}

export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** "2026-10" -> Date đầu tháng. */
export function parseMonth(month: string): Date {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, (monthIndex ?? 1) - 1, 1);
}

export function formatMonth(date: Date): string {
  return format(date, 'yyyy-MM');
}

/** Lưới lịch tháng, tuần bắt đầu từ thứ Hai, đủ tuần (gồm ngày của tháng trước/sau). */
export function buildMonthGrid(month: string, today: string): CalendarDay[][] {
  const first = parseMonth(month);
  const start = startOfWeek(startOfMonth(first), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const weeks: CalendarDay[][] = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const current = addDays(day, index);
        const date = toIsoDate(current);
        return {
          date,
          dayOfMonth: current.getDate(),
          inMonth: current.getMonth() === first.getMonth(),
          isToday: date === today,
          isSunday: isSunday(current),
        };
      }),
    );
  }
  return weeks;
}

/** Khoảng ngày hiển thị trên lưới (để gọi API một lần cho cả tháng). */
export function gridRange(month: string): { from: string; to: string } {
  const first = parseMonth(month);
  return {
    from: toIsoDate(startOfWeek(startOfMonth(first), { weekStartsOn: 1 })),
    to: toIsoDate(endOfWeek(endOfMonth(first), { weekStartsOn: 1 })),
  };
}
