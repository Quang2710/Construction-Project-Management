import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbService } from '../../../../core/layout/breadcrumb/breadcrumb.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate } from '../../../../shared/utils/date.utils';
import { DiaryStatusChipComponent } from '../../components/diary-status-chip/diary-status-chip.component';
import { PhotoGalleryComponent } from '../../../../shared/ui/photo-gallery/photo-gallery.component';
import { ReviewDialogComponent, ReviewDialogData } from '../../components/review-dialog/review-dialog.component';
import { DiaryDetailStore } from '../../data-access/diary-detail.store';
import {
  DIARY_ACTION_LABELS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  WEATHER_ICONS,
  WEATHER_LABELS,
} from '../../models/site-diary.model';

@Component({
  selector: 'app-diary-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RoleLabelPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    DiaryStatusChipComponent,
    PhotoGalleryComponent,
  ],
  providers: [DiaryDetailStore],
  templateUrl: './diary-detail-page.component.html',
  styleUrl: './diary-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryDetailPageComponent {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  private readonly breadcrumbs = inject(BreadcrumbService);
  protected readonly store = inject(DiaryDetailStore);

  /** Tham số :id của route. */
  readonly id = input.required<string>();

  protected readonly weatherIcons = WEATHER_ICONS;
  protected readonly weatherLabels = WEATHER_LABELS;
  protected readonly incidentTypeLabels = INCIDENT_TYPE_LABELS;
  protected readonly severityLabels = INCIDENT_SEVERITY_LABELS;
  protected readonly actionLabels = DIARY_ACTION_LABELS;
  protected readonly exporting = signal(false);

  protected readonly dateValue = computed(() => {
    const diary = this.store.diary();
    return diary ? parseIsoDate(diary.date) : null;
  });
  protected readonly site = computed(() => {
    const project = this.store.diary()?.project;
    return project ? { lat: project.lat, lng: project.lng } : null;
  });
  protected readonly history = computed(() => [...(this.store.diary()?.history ?? [])].reverse());

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    effect(() => {
      const diary = this.store.diary();
      if (diary) {
        this.breadcrumbs.setLabel(`/site-diaries/${diary.id}`, `${diary.project.code} · ${diary.date.split('-').reverse().join('/')}`);
      }
    });
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected async submit(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Gửi duyệt nhật ký',
      message: 'Sau khi gửi, nhật ký sẽ bị khoá chỉnh sửa cho tới khi được duyệt hoặc trả lại.',
      confirmText: 'Gửi duyệt',
    });
    if (confirmed && (await this.store.submit())) {
      this.notification.success('Đã gửi nhật ký cho quản lý dự án duyệt.');
    }
  }

  protected async review(mode: 'approve' | 'reject'): Promise<void> {
    const diary = this.store.diary();
    if (!diary) {
      return;
    }
    const ref = this.dialog.open<ReviewDialogComponent, ReviewDialogData, string>(ReviewDialogComponent, {
      data: { mode, title: `${diary.project.code} · ngày ${diary.date.split('-').reverse().join('/')}` },
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const note = await firstValueFrom(ref.afterClosed());
    if (note === undefined) {
      return;
    }
    const ok = mode === 'approve' ? await this.store.approve(note) : await this.store.reject(note);
    if (ok) {
      this.notification.success(mode === 'approve' ? 'Đã phê duyệt nhật ký.' : 'Đã trả lại nhật ký cho người lập.');
    }
  }

  protected async remove(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Xoá bản nháp',
      message: 'Xoá nhật ký nháp này? Thao tác không thể hoàn tác.',
      confirmText: 'Xoá',
      destructive: true,
    });
    if (confirmed && (await this.store.remove())) {
      this.notification.success('Đã xoá nhật ký nháp.');
      await this.router.navigate(['/site-diaries']);
    }
  }

  protected async exportPdf(): Promise<void> {
    const diary = this.store.diary();
    if (!diary || this.exporting()) {
      return;
    }
    this.exporting.set(true);
    try {
      // Tải lười: pdfmake và font chỉ nạp khi cần.
      const { exportDiaryPdf } = await import('../../utils/diary-pdf');
      await exportDiaryPdf(diary);
    } catch {
      this.notification.error('Không xuất được PDF. Vui lòng thử lại.');
    } finally {
      this.exporting.set(false);
    }
  }
}
