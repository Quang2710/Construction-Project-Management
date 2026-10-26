import { Pipe, PipeTransform } from '@angular/core';

/**
 * `[options]="items | mutable"`: component PrimeNG khai báo options là mảng ghi được (any[])
 * trong khi model của app dùng readonly. Pipe chỉ đổi kiểu, giữ nguyên tham chiếu (không sao chép).
 */
@Pipe({ name: 'mutable' })
export class MutablePipe implements PipeTransform {
  transform<T>(value: readonly T[]): T[];
  transform<T>(value: readonly T[] | null | undefined): T[] | null | undefined;
  transform<T>(value: readonly T[] | null | undefined): T[] | null | undefined {
    return value as T[] | null | undefined;
  }
}
