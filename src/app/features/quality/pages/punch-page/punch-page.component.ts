import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../../../../core/layout/breadcrumb/breadcrumb.service';
import { PhotoGalleryComponent } from '../../../../shared/ui/photo-gallery/photo-gallery.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { QualityDialogsService } from '../../components/quality-dialogs.service';
import { QualityStatusChipComponent } from '../../components/quality-status-chip/quality-status-chip.component';
import { SeverityBadgeComponent } from '../../components/severity-badge/severity-badge.component';
import { PunchDetailStore } from '../../data-access/punch-detail.store';
import { PUNCH_ACTION_LABELS } from '../../models/quality.model';

@Component({
  selector: 'app-punch-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PhotoGalleryComponent,
    ErrorStateComponent,
    QualityStatusChipComponent,
    SeverityBadgeComponent,
  ],
  providers: [PunchDetailStore],
  template: `
    @if (store.loading() && !store.item()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (store.error(); as error) {
      <app-error-state title="Không tải được lỗi cần xử lý" [message]="error" (retry)="reload()" />
    } @else if (store.item(); as item) {
      <a class="back" routerLink="/quality" [queryParams]="backQuery()"><mat-icon>arrow_back</mat-icon> Punch list</a>

      <header class="header">
        <div>
          <div class="header__meta">
            <span class="header__code">{{ item.project.code }} · {{ item.code }}</span>
            <app-quality-status-chip [status]="item.status" />
            <app-severity-badge [severity]="item.severity" />
          </div>
          <h1 class="header__title">{{ item.title }}</h1>
          <p class="header__sub">{{ item.location || 'Chưa ghi vị trí' }}</p>
        </div>

        <div class="header__actions">
          @if (store.canReassign()) {
            <button mat-stroked-button type="button" [disabled]="store.busy()" (click)="reassign()">
              <mat-icon>person_edit</mat-icon> Giao lại
            </button>
          }
          @if (store.canStart()) {
            <button mat-stroked-button type="button" [disabled]="store.busy()" (click)="store.transition('start')">
              <mat-icon>construction</mat-icon> Bắt đầu xử lý
            </button>
          }
          @if (store.canResolve()) {
            <button mat-flat-button type="button" [disabled]="store.busy()" (click)="resolve()">
              <mat-icon>add_a_photo</mat-icon> Báo đã khắc phục
            </button>
          }
          @if (store.canReopen()) {
            <button mat-stroked-button type="button" class="danger" [disabled]="store.busy()" (click)="reopen()">
              <mat-icon>replay</mat-icon> Mở lại
            </button>
          }
          @if (store.canVerify()) {
            <button mat-flat-button type="button" [disabled]="store.busy()" (click)="store.transition('verify')">
              <mat-icon>task_alt</mat-icon> Xác nhận đóng
            </button>
          }
        </div>
      </header>

      @if (store.busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (item.isOverdue) {
        <div class="banner banner--error" role="status">
          <mat-icon>alarm</mat-icon>
          <span>Đã quá hạn xử lý ({{ item.dueDate | date: 'dd/MM/yyyy' }}).</span>
        </div>
      } @else if (item.status === 'RESOLVED' && store.isAssignee()) {
        <div class="banner banner--info" role="status">
          <mat-icon>hourglass_top</mat-icon>
          <span>Đã báo khắc phục, đang chờ quản lý dự án xác nhận.</span>
        </div>
      }

      <div class="layout">
        <div class="side">
          <section class="card">
            <dl class="facts">
              <div>
                <dt>Người xử lý</dt>
                <dd>{{ item.assignee?.fullName ?? 'Chưa giao' }}</dd>
              </div>
              <div>
                <dt>Hạn xử lý</dt>
                <dd [class.overdue]="item.isOverdue">{{ item.dueDate | date: 'dd/MM/yyyy' }}</dd>
              </div>
              <div>
                <dt>Người ghi nhận</dt>
                <dd>{{ item.createdBy.fullName }} · {{ item.createdAt | date: 'dd/MM/yyyy' }}</dd>
              </div>
              @if (item.inspectionId) {
                <div>
                  <dt>Từ phiếu nghiệm thu</dt>
                  <dd><a [routerLink]="['/quality/inspections', item.inspectionId]">{{ item.inspectionCode }}</a></dd>
                </div>
              }
            </dl>
            @if (item.description) {
              <p class="description">{{ item.description }}</p>
            }
          </section>

          <div class="compare">
            <section class="card">
              <h2 class="card__title compare__title"><mat-icon>report</mat-icon> Trước khi khắc phục</h2>
              <app-photo-gallery [photos]="item.beforePhotos" [site]="site()" />
            </section>
            <section class="card">
              <h2 class="card__title compare__title"><mat-icon>task_alt</mat-icon> Sau khi khắc phục</h2>
              @if (item.afterPhotos.length) {
                <app-photo-gallery [photos]="item.afterPhotos" [site]="site()" />
              } @else {
                <p class="empty">Chưa có ảnh sau khắc phục.</p>
              }
            </section>
          </div>
        </div>

        <aside class="side">
          <section class="card">
            <h2 class="card__title">Lịch sử xử lý</h2>
            <ul class="history">
              @for (entry of history(); track $index) {
                <li>
                  <span class="history__action">{{ actionLabels[entry.action] }}</span>
                  <span class="history__meta"> · {{ entry.by.fullName }} · {{ entry.at | date: 'HH:mm dd/MM/yyyy' }}</span>
                  @if (entry.note) {
                    <div class="history__note">“{{ entry.note }}”</div>
                  }
                </li>
              }
            </ul>
          </section>
        </aside>
      </div>
    }
  `,
  styleUrls: ['../detail.scss'],
  styles: `
    .description {
      margin: 16px 0 0;
      white-space: pre-line;
    }
    .compare {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .compare__title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 12px;
    }
    .empty {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 599.98px) {
      .compare {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PunchPageComponent {
  private readonly breadcrumbs = inject(BreadcrumbService);
  private readonly dialogs = inject(QualityDialogsService);
  protected readonly store = inject(PunchDetailStore);

  /** Tham số :id của route. */
  readonly id = input.required<string>();

  protected readonly actionLabels = PUNCH_ACTION_LABELS;
  protected readonly backQuery = computed(() => ({ projectId: this.store.item()?.projectId, tab: 'punch' }));
  protected readonly history = computed(() => [...(this.store.item()?.history ?? [])].reverse());
  protected readonly site = computed(() => {
    const project = this.store.item()?.project;
    return project ? { lat: project.lat, lng: project.lng } : null;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    effect(() => {
      const item = this.store.item();
      if (item) {
        this.breadcrumbs.setLabel(`/quality/punch/${item.id}`, `${item.project.code} · ${item.code}`);
      }
    });
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected async resolve(): Promise<void> {
    const item = this.store.item();
    const result = item ? await this.dialogs.resolve(`${item.code} · ${item.title}`) : undefined;
    if (result) {
      await this.store.resolve(result.note, result.files);
    }
  }

  protected async reopen(): Promise<void> {
    const item = this.store.item();
    if (!item) {
      return;
    }
    const note = await this.dialogs.note({
      title: 'Mở lại lỗi',
      subtitle: `${item.code} · ${item.title}`,
      label: 'Lý do chưa đạt',
      confirmText: 'Mở lại',
      required: true,
      requiredMessage: 'Vui lòng nêu lý do để người xử lý khắc phục tiếp.',
      destructive: true,
    });
    if (note !== undefined) {
      await this.store.transition('reopen', note);
    }
  }

  protected async reassign(): Promise<void> {
    const item = this.store.item();
    if (!item) {
      return;
    }
    const result = await this.dialogs.reassign({ members: this.store.members(), assigneeId: item.assignee?.id ?? null, dueDate: item.dueDate });
    if (result) {
      await this.store.reassign(result.assigneeId, result.dueDate);
    }
  }
}
