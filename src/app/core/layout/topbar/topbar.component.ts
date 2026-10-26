import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { AuthStore } from '../../auth/auth.store';
import { DemoDataService } from '../../demo/demo-data.service';
import { NotificationService } from '../../notifications/notification.service';
import { PwaService } from '../../pwa/pwa.service';
import { NetworkIndicatorComponent } from '../network-indicator/network-indicator.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { ThemeService } from '../../theme/theme.service';

@Component({
  selector: 'app-topbar',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    UserAvatarComponent,
    NetworkIndicatorComponent,
    NotificationBellComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeService);
  protected readonly demoData = inject(DemoDataService);
  protected readonly pwa = inject(PwaService);

  readonly menuToggle = output<void>();

  protected readonly resetting = signal(false);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  protected async resetDemoData(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reset dữ liệu demo',
      message: 'Toàn bộ thay đổi bạn đã thực hiện sẽ bị xoá và dữ liệu mẫu ban đầu được khôi phục. Tiếp tục?',
      confirmText: 'Reset dữ liệu',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.resetting.set(true);
    try {
      await this.demoData.reset();
    } catch {
      this.resetting.set(false);
      this.notification.error('Không thể reset dữ liệu demo. Vui lòng thử lại.');
    }
  }
}
