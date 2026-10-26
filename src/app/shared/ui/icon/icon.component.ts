import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Icon Material Symbols (font nạp ở index.html): `<app-icon>search</app-icon>`.
 * Dùng font thay vì PrimeIcons vì bộ Material Symbols có đủ icon nghiệp vụ xây dựng (fact_check, construction...).
 * Mặc định 24px; đổi cỡ bằng `font-size` ở component cha.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'material-symbols-outlined app-icon', 'aria-hidden': 'true' },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
      overflow: hidden;
      font-size: 24px;
      line-height: 1;
      user-select: none;
    }
  `,
})
export class IconComponent {}
