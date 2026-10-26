import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthStore } from '../../../../core/auth/auth.store';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-forbidden-page',
  imports: [
    RouterLink,
    ButtonModule,
    IconComponent,
  ],
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
        <button pButton outlined type="button" (click)="location.back()">
          <app-icon>arrow_back</app-icon>
          Quay lại
        </button>
        <a pButton routerLink="/dashboard">
          <app-icon>home</app-icon>
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
