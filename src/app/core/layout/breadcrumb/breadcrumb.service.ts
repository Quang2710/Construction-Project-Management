import { Injectable, signal } from '@angular/core';

/**
 * Cho phép trang ghi đè nhãn breadcrumb động (ví dụ hiển thị mã dự án thay cho "Chi tiết").
 * Khoá là URL của mục breadcrumb, ví dụ "/projects/prj-gthm".
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly overridesSignal = signal<ReadonlyMap<string, string>>(new Map());

  readonly overrides = this.overridesSignal.asReadonly();

  setLabel(url: string, label: string): void {
    this.overridesSignal.update((current) => new Map(current).set(url, label));
  }
}
