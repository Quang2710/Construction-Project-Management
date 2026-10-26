import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NetworkStatusService } from '../../offline/network-status.service';
import { OutboxService } from '../../offline/outbox.service';

type IndicatorState = 'offline' | 'syncing' | 'failed' | 'pending' | 'cached' | 'ok';

/** Trạng thái mạng + hàng đợi đồng bộ offline trên topbar. Ẩn khi mọi thứ bình thường. */
@Component({
  selector: 'app-network-indicator',
  imports: [DatePipe, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule, MatTooltipModule, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() !== 'ok') {
      <button type="button" class="chip" [class]="'chip chip--' + state()" [matMenuTriggerFor]="menu" [attr.aria-label]="label()">
        @if (state() === 'syncing') {
          <mat-spinner diameter="16" />
        } @else {
          <mat-icon>{{ icon() }}</mat-icon>
        }
        <span class="chip__text">{{ label() }}</span>
      </button>

      <mat-menu #menu="matMenu" xPosition="before" class="network-menu">
        <div class="head" role="presentation" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
          <p class="head__title">{{ network.online() ? 'Đang có mạng' : 'Đang mất mạng' }}</p>
          @if (network.cachedDataAt(); as cachedAt) {
            <p class="head__sub">Đang xem dữ liệu lưu trên máy (cập nhật {{ cachedAt | relativeTime }}).</p>
          } @else if (!network.online()) {
            <p class="head__sub">Trang đã mở vẫn xem được; nhật ký lập lúc này sẽ tự gửi khi có mạng.</p>
          }
        </div>
        @if (outbox.entries().length) {
          <mat-divider />
          <p class="section">Chờ đồng bộ ({{ outbox.entries().length }})</p>
          @for (entry of outbox.entries(); track entry.id) {
            <div class="entry" role="presentation" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
              <mat-icon class="entry__icon" [class.entry__icon--failed]="entry.status === 'failed'">
                {{ entry.status === 'failed' ? 'sync_problem' : 'schedule_send' }}
              </mat-icon>
              <div class="entry__body">
                <p class="entry__label">{{ entry.label }}</p>
                <p class="entry__meta">
                  @if (entry.status === 'failed') {
                    <span class="entry__error">{{ entry.error }}</span>
                  } @else {
                    Lưu lúc {{ entry.createdAt | date: 'HH:mm dd/MM' }}
                  }
                </p>
              </div>
              @if (entry.status === 'failed') {
                <button mat-icon-button type="button" aria-label="Thử lại" matTooltip="Thử lại" (click)="outbox.retry(entry.id)">
                  <mat-icon>refresh</mat-icon>
                </button>
                <button mat-icon-button type="button" aria-label="Bỏ mục này" matTooltip="Bỏ (không gửi)" (click)="outbox.discard(entry.id)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              }
            </div>
          }
          <mat-divider />
          <button mat-menu-item type="button" [disabled]="!network.online() || outbox.syncing() || outbox.pendingCount() === 0" (click)="outbox.sync()">
            <mat-icon>sync</mat-icon>
            <span>Đồng bộ ngay</span>
          </button>
        }
      </mat-menu>
    }
  `,
  styleUrl: './network-indicator.component.scss',
})
export class NetworkIndicatorComponent {
  protected readonly network = inject(NetworkStatusService);
  protected readonly outbox = inject(OutboxService);

  protected readonly state = computed<IndicatorState>(() => {
    if (!this.network.online()) {
      return 'offline';
    }
    if (this.outbox.syncing()) {
      return 'syncing';
    }
    if (this.outbox.failedCount()) {
      return 'failed';
    }
    if (this.outbox.pendingCount()) {
      return 'pending';
    }
    return this.network.cachedDataAt() ? 'cached' : 'ok';
  });

  protected readonly icon = computed(() => {
    const icons: Readonly<Record<IndicatorState, string>> = {
      offline: 'cloud_off',
      syncing: 'sync',
      failed: 'sync_problem',
      pending: 'schedule_send',
      cached: 'history',
      ok: 'cloud_done',
    };
    return icons[this.state()];
  });

  protected readonly label = computed(() => {
    const pending = this.outbox.entries().length;
    switch (this.state()) {
      case 'offline':
        return pending ? `Ngoại tuyến · ${pending} chờ gửi` : 'Ngoại tuyến';
      case 'syncing':
        return 'Đang đồng bộ…';
      case 'failed':
        return `${this.outbox.failedCount()} mục lỗi đồng bộ`;
      case 'pending':
        return `${this.outbox.pendingCount()} chờ đồng bộ`;
      case 'cached':
        return 'Dữ liệu đã lưu';
      default:
        return 'Trực tuyến';
    }
  });
}
