import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="error error--fullscreen">
      <p class="error__code">404</p>
      <h1 class="error__title">Không tìm thấy trang</h1>
      <p class="error__message">Đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi.</p>
      <div class="error__actions">
        <a mat-flat-button routerLink="/">
          <mat-icon>home</mat-icon>
          Về trang chủ
        </a>
      </div>
    </section>
  `,
  styleUrl: '../error-page.scss',
})
export class NotFoundPageComponent {}
