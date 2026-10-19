import { Pipe, PipeTransform } from '@angular/core';
import { formatVnd, formatVndCompact } from '../utils/currency.utils';

/** {{ amount | vnd }} -> "450.000.000.000 ₫"; {{ amount | vnd: 'compact' }} -> "450 tỷ" */
@Pipe({ name: 'vnd' })
export class VndPipe implements PipeTransform {
  transform(amount: number | null | undefined, format: 'full' | 'compact' = 'full'): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return '—';
    }
    return format === 'compact' ? formatVndCompact(amount) : formatVnd(amount);
  }
}
