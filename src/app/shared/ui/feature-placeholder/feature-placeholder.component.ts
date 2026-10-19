import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Màn hình tạm cho các module sẽ được xây dựng ở giai đoạn sau.
 * Nhận dữ liệu từ route data qua withComponentInputBinding().
 */
@Component({
  selector: 'app-feature-placeholder',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <mat-icon class="placeholder__icon">{{ icon() }}</mat-icon>
      <h1 class="placeholder__title">{{ breadcrumb() }}</h1>
      <p class="placeholder__desc">{{ description() }}</p>
      <p class="placeholder__note">Chức năng đang được xây dựng ở các giai đoạn tiếp theo.</p>
    </section>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 64px 16px;
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-low);
    }
    .placeholder__icon {
      width: 56px;
      height: 56px;
      font-size: 56px;
      color: var(--mat-sys-primary);
    }
    .placeholder__title {
      margin: 16px 0 4px;
      font: var(--mat-sys-headline-small);
    }
    .placeholder__desc {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .placeholder__note {
      margin: 16px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-outline);
    }
  `,
})
export class FeaturePlaceholderComponent {
  readonly breadcrumb = input('');
  readonly description = input('');
  readonly icon = input('construction');
}
