import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { diffImages, ImageDiffResult } from '../../utils/image-diff';
import { closePdf, fitWidthScale, openPdf, PdfDocument, renderPage } from '../../utils/pdf-renderer';

export type CompareMode = 'overlay' | 'side';

const ZOOM_STEP = 1.25;
/** Khớp breakpoint 720px trong pdf-compare.component.scss (trừ padding khung). */
const SIDE_BY_SIDE_MIN_WIDTH = 696;

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ canvas.');
  }
  return ctx;
}

/** Vẽ ảnh nguồn lên canvas đích đúng kích thước đích (khi hai bản khác khổ giấy). */
function imageDataAt(source: HTMLCanvasElement, width: number, height: number): ImageData {
  if (source.width === width && source.height === height) {
    return context(source).getImageData(0, 0, width, height);
  }
  const resized = document.createElement('canvas');
  resized.width = width;
  resized.height = height;
  const ctx = context(resized);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** So sánh hai phiên bản bản vẽ: chồng lớp tô màu khác biệt, hoặc đặt cạnh nhau cuộn đồng bộ. */
@Component({
  selector: 'app-pdf-compare',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-compare.component.html',
  styleUrl: './pdf-compare.component.scss',
})
export class PdfCompareComponent implements OnDestroy {
  readonly older = input.required<ArrayBuffer>();
  readonly newer = input.required<ArrayBuffer>();
  readonly olderLabel = input.required<string>();
  readonly newerLabel = input.required<string>();

  private readonly overlayCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly leftCanvas = viewChild<ElementRef<HTMLCanvasElement>>('left');
  private readonly rightCanvas = viewChild<ElementRef<HTMLCanvasElement>>('right');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  protected readonly zoomStep = ZOOM_STEP;
  protected readonly mode = signal<CompareMode>('overlay');
  protected readonly page = signal(1);
  protected readonly pageCount = signal(0);
  /** null = vừa khung. */
  private readonly scale = signal<number | null>(null);
  protected readonly percent = signal(100);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly stats = signal<Omit<ImageDiffResult, 'pixels'> | null>(null);

  private readonly docs = signal<readonly [PdfDocument, PdfDocument] | null>(null);
  private token = 0;
  private queue: Promise<void> = Promise.resolve();
  private syncing = false;

  constructor() {
    effect(() => {
      const older = this.older();
      const newer = this.newer();
      untracked(() => void this.open(older, newer));
    });
    effect(() => {
      const docs = this.docs();
      const mode = this.mode();
      const page = this.page();
      const scale = this.scale();
      if (docs) {
        // Đợi view cập nhật canvas của chế độ mới trước khi vẽ.
        untracked(() => queueMicrotask(() => this.schedule(docs, mode, page, scale)));
      }
    });
  }

  ngOnDestroy(): void {
    this.docs()?.forEach(closePdf);
  }

  protected setMode(mode: CompareMode): void {
    this.mode.set(mode);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected zoom(factor: number): void {
    this.scale.set(Math.min(6, Math.max(0.2, (this.percent() / 100) * factor)));
  }

  protected fit(): void {
    this.scale.set(null);
  }

  /** Cuộn một bên thì bên kia cuộn theo (chế độ cạnh nhau). */
  protected syncScroll(source: HTMLElement, target: HTMLElement): void {
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => (this.syncing = false));
  }

  private async open(older: ArrayBuffer, newer: ArrayBuffer): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const previous = this.docs();
      const docs = [await openPdf(older), await openPdf(newer)] as const;
      previous?.forEach(closePdf);
      this.pageCount.set(Math.min(docs[0].numPages, docs[1].numPages));
      this.page.set(1);
      this.docs.set(docs);
    } catch {
      this.busy.set(false);
      this.error.set('Không mở được một trong hai tệp PDF.');
    }
  }

  private schedule(docs: readonly [PdfDocument, PdfDocument], mode: CompareMode, page: number, scale: number | null): void {
    const token = ++this.token;
    this.busy.set(true);
    this.queue = this.queue.then(() => (token === this.token ? this.draw(token, docs, mode, page, scale) : undefined));
  }

  private async draw(
    token: number,
    [olderDoc, newerDoc]: readonly [PdfDocument, PdfDocument],
    mode: CompareMode,
    page: number,
    scale: number | null,
  ): Promise<void> {
    try {
      const frameWidth = this.frame().nativeElement.clientWidth - 24;
      // Màn hình hẹp: hai bản xếp chồng (xem scss) nên mỗi bản rộng bằng cả khung.
      const columnWidth = mode === 'side' && frameWidth >= SIDE_BY_SIDE_MIN_WIDTH ? frameWidth / 2 - 12 : frameWidth;
      const target = scale ?? (await fitWidthScale(newerDoc, page, columnWidth));
      if (mode === 'overlay') {
        const visible = this.overlayCanvas()?.nativeElement;
        if (!visible) {
          return;
        }
        const a = document.createElement('canvas');
        const b = document.createElement('canvas');
        await renderPage(olderDoc, page, target, a);
        await renderPage(newerDoc, page, target, b);
        if (token !== this.token) {
          return;
        }
        const before = imageDataAt(a, b.width, b.height);
        const after = context(b).getImageData(0, 0, b.width, b.height);
        const { pixels, ...stats } = diffImages(before.data, after.data);
        visible.width = b.width;
        visible.height = b.height;
        visible.style.width = b.style.width;
        visible.style.height = b.style.height;
        context(visible).putImageData(new ImageData(pixels, b.width, b.height), 0, 0);
        this.stats.set(stats);
      } else {
        const left = this.leftCanvas()?.nativeElement;
        const right = this.rightCanvas()?.nativeElement;
        if (!left || !right) {
          return;
        }
        await renderPage(olderDoc, page, target, left);
        await renderPage(newerDoc, page, target, right);
      }
      if (token === this.token) {
        this.percent.set(Math.round(target * 100));
      }
    } catch {
      if (token === this.token) {
        this.error.set('Không hiển thị được trang để so sánh.');
      }
    } finally {
      if (token === this.token) {
        this.busy.set(false);
      }
    }
  }
}
