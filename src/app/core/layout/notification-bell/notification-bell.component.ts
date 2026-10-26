import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { NOTIFICATION_ICONS } from '../../../shared/models/notification.model';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NotificationCenterStore } from '../../notifications/notification-center.store';
import { RealtimeService } from '../../realtime/realtime.service';

/** Chuông thông báo trên topbar: số chưa đọc, danh sách mới nhất, đánh dấu đã đọc. */
@Component({
  selector: 'app-notification-bell',
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="label()"
      [matTooltip]="label()"
      [matBadge]="badge()"
      [matBadgeHidden]="store.unreadCount() === 0"
      matBadgeColor="warn"
      matBadgeSize="small"
    >
      <mat-icon>{{ store.unreadCount() ? 'notifications_unread' : 'notifications' }}</mat-icon>
    </button>

    <mat-menu #menu="matMenu" xPosition="before" class="bell-menu">
      <div class="head" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" role="presentation">
        <div>
          <p class="head__title">Thông báo</p>
          <p class="head__status" [class.head__status--live]="live()">
            <span class="dot"></span>{{ live() ? 'Đang nhận trực tiếp' : 'Đang kết nối lại…' }}
          </p>
        </div>
        <button mat-button type="button" [disabled]="store.unreadCount() === 0" (click)="store.markAllRead()">Đã đọc tất cả</button>
      </div>
      <mat-divider />
      @if (store.loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (store.error(); as error) {
        <p class="empty">{{ error }}</p>
      } @else if (!store.loading() && store.items().length === 0) {
        <p class="empty">Chưa có thông báo nào.</p>
      }
      @for (item of store.items(); track item.id) {
        <button mat-menu-item type="button" class="item" [class.item--unread]="!item.read" (click)="store.open(item)">
          <mat-icon class="item__icon">{{ icons[item.type] }}</mat-icon>
          <span class="item__body">
            <span class="item__title">{{ item.title }}</span>
            @if (item.message) {
              <span class="item__message">{{ item.message }}</span>
            }
            <span class="item__meta">{{ item.projectCode ? item.projectCode + ' · ' : '' }}{{ item.createdAt | relativeTime }}</span>
          </span>
          @if (!item.read) {
            <span class="item__unread" aria-label="Chưa đọc"></span>
          }
        </button>
      }
      <mat-divider />
      <a mat-menu-item routerLink="/notifications" class="all">Xem tất cả thông báo</a>
    </mat-menu>
  `,
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  protected readonly store = inject(NotificationCenterStore);
  private readonly realtime = inject(RealtimeService);

  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly live = computed(() => this.realtime.status() === 'open');
  protected readonly badge = computed(() => (this.store.unreadCount() > 99 ? '99+' : String(this.store.unreadCount())));
  protected readonly label = computed(() =>
    this.store.unreadCount() ? `Thông báo, ${this.store.unreadCount()} chưa đọc` : 'Thông báo',
  );
}
