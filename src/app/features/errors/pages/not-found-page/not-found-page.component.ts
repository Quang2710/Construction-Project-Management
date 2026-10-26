import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-not-found-page',
  imports: [
    RouterLink,
    ButtonModule,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="error error--fullscreen">
      <p class="error__code">404</p>
      <h1 class="error__title">Không tìm thấy trang</h1>
      <p class="error__message">Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi.</p>
      <div class="error__actions">
        <a pButton routerLink="/">
          <app-icon>home</app-icon>
          Về trang chủ
        </a>
      </div>
    </section>
  `,
  styleUrl: '../error-page.scss',
})
export class NotFoundPageComponent {}
