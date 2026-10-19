import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Tiêu đề trang + vùng nút hành động (ng-content). */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header__text">
      <h1 class="header__title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="header__subtitle">{{ subtitle() }}</p>
      }
    </div>
    <div class="header__actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px 16px;
      margin-bottom: 20px;
    }
    .header__title {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }
    .header__subtitle {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
