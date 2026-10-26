import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { PopoverModule } from 'primeng/popover';
import { NOTIFICATION_ICONS } from '../../../shared/models/notification.model';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NotificationCenterStore } from '../../notifications/notification-center.store';
import { RealtimeService } from '../../realtime/realtime.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** Chuông thông báo trên topbar: số chưa đọc, danh sách mới nhất, đánh dấu đã đọc. */
@Component({
  selector: 'app-notification-bell',
  imports: [
    PopoverModule,
    RouterLink,
    RelativeTimePipe,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="trigger">
      <button
        pButton
        text
        rounded
        severity="secondary"
        type="button"
        aria-haspopup="dialog"
        [attr.aria-label]="label()"
        [pTooltip]="label()"
        tooltipPosition="bottom"
        (click)="panel.toggle($event)"
      >
        <app-icon pButtonIcon>{{ store.unreadCount() ? 'notifications_unread' : 'notifications' }}</app-icon>
      </button>
      @if (store.unreadCount()) {
        <span class="badge" aria-hidden="true">{{ badge() }}</span>
      }
    </span>

    <p-popover #panel styleClass="app-popover">
      <div class="panel">
        <div class="head">
          <div>
            <p class="head__title">Thông báo</p>
            <p class="head__status" [class.head__status--live]="live()">
              <span class="dot"></span>{{ live() ? 'Đang nhận trực tiếp' : 'Đang kết nối lại…' }}
            </p>
          </div>
          <button pButton text size="small" type="button" [disabled]="store.unreadCount() === 0" (click)="store.markAllRead()">
            Đã đọc tất cả
          </button>
        </div>
        @if (store.loading()) {
          <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
        }
        <div class="list">
          @if (store.error(); as error) {
            <p class="empty">{{ error }}</p>
          } @else if (!store.loading() && store.items().length === 0) {
            <p class="empty"><app-icon>notifications_off</app-icon> Chưa có thông báo nào.</p>
          }
          @for (item of store.items(); track item.id) {
            <button type="button" class="item" [class.item--unread]="!item.read" (click)="panel.hide(); store.open(item)">
              <span class="item__icon"><app-icon>{{ icons[item.type] }}</app-icon></span>
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
        </div>
        <a class="all" routerLink="/notifications" (click)="panel.hide()">Xem tất cả thông báo</a>
      </div>
    </p-popover>
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
