import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PopoverModule } from 'primeng/popover';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NetworkStatusService } from '../../offline/network-status.service';
import { OutboxService } from '../../offline/outbox.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

type IndicatorState = 'offline' | 'syncing' | 'failed' | 'pending' | 'cached' | 'ok';

/** Trạng thái mạng + hàng đợi đồng bộ offline trên topbar. Ẩn khi mọi thứ bình thường. */
@Component({
  selector: 'app-network-indicator',
  imports: [
    DatePipe,
    PopoverModule,
    RelativeTimePipe,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() !== 'ok') {
      <button type="button" class="chip" [class]="'chip chip--' + state()" aria-haspopup="dialog" [attr.aria-label]="label()" (click)="panel.toggle($event)">
        @if (state() === 'syncing') {
          <p-progress-spinner strokeWidth="6" ariaLabel="Đang đồng bộ" style="width: 16px; height: 16px" />
        } @else {
          <app-icon>{{ icon() }}</app-icon>
        }
        <span class="chip__text">{{ label() }}</span>
      </button>

      <p-popover #panel styleClass="app-popover">
        <div class="panel">
          <div class="head">
            <p class="head__title">{{ network.online() ? 'Đang có mạng' : 'Đang mất mạng' }}</p>
            @if (network.cachedDataAt(); as cachedAt) {
              <p class="head__sub">Đang xem dữ liệu lưu trên máy (cập nhật {{ cachedAt | relativeTime }}).</p>
            } @else if (!network.online()) {
              <p class="head__sub">Trang đã mở vẫn xem được; nhật ký lập lúc này sẽ tự gửi khi có mạng.</p>
            }
          </div>
          @if (outbox.entries().length) {
            <p class="section">Chờ đồng bộ ({{ outbox.entries().length }})</p>
            <div class="entries">
              @for (entry of outbox.entries(); track entry.id) {
                <div class="entry">
                  <app-icon class="entry__icon" [class.entry__icon--failed]="entry.status === 'failed'">
                    {{ entry.status === 'failed' ? 'sync_problem' : 'schedule_send' }}
                  </app-icon>
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
                    <button pButton text rounded severity="secondary" size="small" type="button" aria-label="Thử lại" pTooltip="Thử lại" tooltipPosition="bottom" (click)="outbox.retry(entry.id)">
                      <app-icon pButtonIcon>refresh</app-icon>
                    </button>
                    <button pButton text rounded severity="danger" size="small" type="button" aria-label="Bỏ mục này" pTooltip="Bỏ (không gửi)" tooltipPosition="bottom" (click)="outbox.discard(entry.id)">
                      <app-icon pButtonIcon>delete_outline</app-icon>
                    </button>
                  }
                </div>
              }
            </div>
            <div class="footer">
              <button pButton outlined size="small" type="button" [disabled]="!network.online() || outbox.syncing() || outbox.pendingCount() === 0" (click)="outbox.sync()">
                <app-icon>sync</app-icon> Đồng bộ ngay
              </button>
            </div>
          }
        </div>
      </p-popover>
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
