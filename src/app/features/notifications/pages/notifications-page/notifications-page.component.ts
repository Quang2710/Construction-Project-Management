import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NotificationCenterStore } from '../../../../core/notifications/notification-center.store';
import { NOTIFICATION_ICONS, NOTIFICATION_TYPE_LABELS } from '../../../../shared/models/notification.model';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { NotificationsListStore } from '../../data-access/notifications-list.store';

@Component({
  selector: 'app-notifications-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    RelativeTimePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  providers: [NotificationsListStore],
  template: `
    <app-page-header title="Thông báo" subtitle="Cập nhật theo thời gian thực từ nhật ký, nghiệm thu, punch list, vật tư và bản vẽ">
      <button mat-stroked-button type="button" [disabled]="center.unreadCount() === 0" (click)="store.markAllRead()">
        <mat-icon>done_all</mat-icon> Đánh dấu đã đọc tất cả
      </button>
    </app-page-header>

    <mat-button-toggle-group
      class="filter"
      [value]="store.unreadOnly()"
      [hideSingleSelectionIndicator]="true"
      aria-label="Lọc thông báo"
      (change)="store.setFilter({ unreadOnly: $event.value })"
    >
      <mat-button-toggle [value]="false">Tất cả</mat-button-toggle>
      <mat-button-toggle [value]="true">Chưa đọc ({{ center.unreadCount() }})</mat-button-toggle>
    </mat-button-toggle-group>

    @if (store.loading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.error(); as error) {
      <app-error-state [message]="error" (retry)="store.load()" />
    } @else if (!store.loading() && store.items().length === 0) {
      <app-empty-state icon="notifications_off" [title]="store.unreadOnly() ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'" />
    } @else {
      <ul class="list">
        @for (item of store.items(); track item.id) {
          <li>
            <button type="button" class="item" [class.item--unread]="!item.read" (click)="store.open(item)">
              <mat-icon class="item__icon">{{ icons[item.type] }}</mat-icon>
              <span class="item__body">
                <span class="item__title">{{ item.title }}</span>
                @if (item.message) {
                  <span class="item__message">{{ item.message }}</span>
                }
                <span class="item__meta">
                  {{ typeLabels[item.type] }}{{ item.projectCode ? ' · ' + item.projectCode : '' }} ·
                  <time [attr.datetime]="item.createdAt" [title]="item.createdAt | date: 'HH:mm dd/MM/yyyy'">{{ item.createdAt | relativeTime }}</time>
                </span>
              </span>
              @if (!item.read) {
                <span class="item__dot" aria-label="Chưa đọc"></span>
              }
            </button>
          </li>
        }
      </ul>
      <mat-paginator
        [length]="store.total()"
        [pageIndex]="store.page() - 1"
        [pageSize]="store.pageSize"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
    }
  `,
  styles: `
    .filter {
      margin-bottom: 12px;
      --mat-standard-button-toggle-height: 36px;
    }
    .list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      list-style: none;
    }
    li + li {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border: 0;
      background: var(--mat-sys-surface);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .item:hover,
    .item:focus-visible {
      background: var(--mat-sys-surface-container-low);
    }
    .item--unread {
      background: color-mix(in srgb, var(--mat-sys-primary-container) 35%, var(--mat-sys-surface));
    }
    .item--unread .item__title {
      font-weight: 600;
    }
    .item--unread .item__icon {
      color: var(--mat-sys-primary);
    }
    .item__icon {
      flex: none;
      color: var(--mat-sys-on-surface-variant);
    }
    .item__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .item__message,
    .item__meta {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .item__dot {
      flex: none;
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  protected readonly store = inject(NotificationsListStore);
  protected readonly center = inject(NotificationCenterStore);
  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly typeLabels = NOTIFICATION_TYPE_LABELS;

  ngOnInit(): void {
    void this.store.load();
  }

  protected onPage(event: PageEvent): void {
    void this.store.setFilter({ page: event.pageIndex + 1 });
  }
}
