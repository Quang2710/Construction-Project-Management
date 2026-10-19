import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="error">
      <p class="error__code">403</p>
      <h1 class="error__title">Không có quyền truy cập</h1>
      <p class="error__message">
        Vai trò <strong>{{ auth.roleLabel() }}</strong> không được phép xem trang này. Liên hệ quản trị viên nếu bạn cần
        được cấp quyền.
      </p>
      <div class="error__actions">
        <button mat-stroked-button type="button" (click)="location.back()">
          <mat-icon>arrow_back</mat-icon>
          Quay lại
        </button>
        <a mat-flat-button routerLink="/dashboard">
          <mat-icon>home</mat-icon>
          Về trang tổng quan
        </a>
      </div>
    </section>
  `,
  styleUrl: '../error-page.scss',
})
export class ForbiddenPageComponent {
  protected readonly auth = inject(AuthStore);
  protected readonly location = inject(Location);
}
