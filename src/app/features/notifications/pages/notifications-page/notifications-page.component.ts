import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { NotificationCenterStore } from '../../../../core/notifications/notification-center.store';
import { NOTIFICATION_ICONS, NOTIFICATION_TYPE_LABELS } from '../../../../shared/models/notification.model';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { NotificationsListStore } from '../../data-access/notifications-list.store';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-notifications-page',
  imports: [
    FormsModule,
    DatePipe,
    SelectButtonModule,
    PaginatorModule,
    RelativeTimePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
  ],
  providers: [NotificationsListStore],
  template: `
    <app-page-header title="Thông báo" subtitle="Cập nhật theo thời gian thực từ nhật ký, nghiệm thu, punch list, vật tư và bản vẽ">
      <button pButton outlined type="button" [disabled]="center.unreadCount() === 0" (click)="store.markAllRead()">
        <app-icon>done_all</app-icon> Đánh dấu đã đọc tất cả
      </button>
    </app-page-header>

    <p-selectbutton
      class="filter app-chips"
      [options]="filterOptions()"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      [ngModel]="store.unreadOnly()"
      (onChange)="store.setFilter({ unreadOnly: $event.value === true })"
      [attr.aria-label]="'Lọc thông báo'"
    />

    @if (store.loading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
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
              <app-icon class="item__icon">{{ icons[item.type] }}</app-icon>
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
      <p-paginator [totalRecords]="store.total()" [first]="(store.page() - 1) * store.pageSize" [rows]="store.pageSize" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
    }
  `,
  styles: `
    .filter {
      display: block;
      margin-bottom: 16px;
    }
    .list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--app-outline-variant);
      border-radius: var(--app-corner-medium);
      list-style: none;
    }
    li + li {
      border-top: 1px solid var(--app-outline-variant);
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border: 0;
      background: var(--app-surface);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .item:hover,
    .item:focus-visible {
      background: var(--app-surface-container-low);
    }
    .item--unread {
      background: color-mix(in srgb, var(--app-primary-container) 35%, var(--app-surface));
    }
    .item--unread .item__title {
      font-weight: 600;
    }
    .item--unread .item__icon {
      color: var(--app-primary);
    }
    .item__icon {
      flex: none;
      color: var(--app-on-surface-variant);
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
      font: var(--app-body-small);
      color: var(--app-on-surface-variant);
    }
    .item__dot {
      flex: none;
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--app-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPageComponent implements OnInit {
  protected readonly store = inject(NotificationsListStore);
  protected readonly center = inject(NotificationCenterStore);
  protected readonly icons = NOTIFICATION_ICONS;
  protected readonly typeLabels = NOTIFICATION_TYPE_LABELS;
  protected readonly filterOptions = computed(() => [
    { label: 'Tất cả', value: false },
    { label: `Chưa đọc (${this.center.unreadCount()})`, value: true },
  ]);

  ngOnInit(): void {
    void this.store.load();
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setFilter({ page: (event.page ?? 0) + 1 });
  }
}
