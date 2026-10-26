import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbService } from '../../../../core/layout/breadcrumb/breadcrumb.service';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import {
  DrawingUploadDialogComponent,
  DrawingUploadDialogData,
  DrawingUploadResult,
} from '../../components/drawing-upload-dialog/drawing-upload-dialog.component';
import { PdfCompareComponent } from '../../components/pdf-compare/pdf-compare.component';
import { PdfViewerComponent } from '../../components/pdf-viewer/pdf-viewer.component';
import { DrawingDetailStore } from '../../data-access/drawing-detail.store';
import { DISCIPLINE_LABELS, nextRevisionLabel } from '../../models/document.model';

@Component({
  selector: 'app-drawing-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ErrorStateComponent,
    PdfCompareComponent,
    PdfViewerComponent,
  ],
  providers: [DrawingDetailStore],
  templateUrl: './drawing-page.component.html',
  styleUrl: './drawing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawingPageComponent {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly breadcrumbs = inject(BreadcrumbService);
  protected readonly store = inject(DrawingDetailStore);

  /** Tham số :id của route. */
  readonly id = input.required<string>();
  /** ?rev=B&compare=A – giữ trạng thái xem để chia sẻ link. */
  readonly rev = input<string>();
  readonly compare = input<string>();

  protected readonly disciplineLabels = DISCIPLINE_LABELS;
  protected readonly comparing = computed(() => this.store.compareId() !== null);
  protected readonly backQuery = computed(() => ({ projectId: this.store.drawing()?.projectId }));
  /** Các phiên bản có thể chọn để so với phiên bản đang xem. */
  protected readonly compareOptions = computed(() => this.store.revisionsDesc().filter((revision) => revision.id !== this.store.revisionId()));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id, this.rev() ?? null, this.compare() ?? null));
    });
    effect(() => {
      const drawing = this.store.drawing();
      if (drawing) {
        this.breadcrumbs.setLabel(`/documents/${drawing.id}`, `${drawing.projectCode} · ${drawing.code}`);
      }
    });
  }

  protected reload(): void {
    void this.store.load(this.id(), this.rev() ?? null, this.compare() ?? null);
  }

  protected async select(revisionId: string): Promise<void> {
    await this.store.selectRevision(revisionId);
    this.syncQuery();
  }

  protected async toggleCompare(): Promise<void> {
    if (this.comparing()) {
      this.store.stopCompare();
    } else {
      await this.store.startCompare();
    }
    this.syncQuery();
  }

  protected async changeCompare(revisionId: string): Promise<void> {
    await this.store.startCompare(revisionId);
    this.syncQuery();
  }

  protected async uploadRevision(): Promise<void> {
    const drawing = this.store.drawing();
    if (!drawing) {
      return;
    }
    const ref = this.dialog.open<DrawingUploadDialogComponent, DrawingUploadDialogData, DrawingUploadResult>(DrawingUploadDialogComponent, {
      width: '560px',
      maxWidth: 'calc(100vw - 24px)',
      data: { mode: 'revision', drawingCode: drawing.code, nextRevision: nextRevisionLabel(drawing.currentRevision.revision) },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (result && (await this.store.addRevision(result.description, result.file))) {
      this.syncQuery();
    }
  }

  private syncQuery(): void {
    void this.router.navigate([], {
      queryParams: { rev: this.store.revision()?.revision ?? null, compare: this.store.compareRevision()?.revision ?? null },
      replaceUrl: true,
    });
  }
}
