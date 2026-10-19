import { Pipe, PipeTransform } from '@angular/core';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

/** "2025-10-01T08:00:00Z" -> "khoảng 2 giờ trước" */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: vi });
  }
}
