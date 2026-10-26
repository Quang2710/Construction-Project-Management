import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { closePdf, fitWidthScale, openPdf, PdfDocument, renderPage } from '../../utils/pdf-renderer';

const ZOOM_STEP = 1.25;
const MIN_SCALE = 0.2;
const MAX_SCALE = 6;

/** Xem PDF trực tiếp bằng pdf.js: chuyển trang, phóng to/thu nhỏ, vừa khung. */
@Component({
  selector: 'app-pdf-viewer',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" role="toolbar" aria-label="Điều khiển xem bản vẽ">
      <button mat-icon-button type="button" aria-label="Trang trước" [disabled]="page() <= 1" (click)="goTo(page() - 1)">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <span class="toolbar__label">Trang {{ page() }}/{{ pageCount() || '–' }}</span>
      <button mat-icon-button type="button" aria-label="Trang sau" [disabled]="page() >= pageCount()" (click)="goTo(page() + 1)">
        <mat-icon>chevron_right</mat-icon>
      </button>
      <span class="toolbar__spacer"></span>
      <button mat-icon-button type="button" aria-label="Thu nhỏ" matTooltip="Thu nhỏ" (click)="zoom(1 / zoomStep)"><mat-icon>zoom_out</mat-icon></button>
      <span class="toolbar__label">{{ percent() }}%</span>
      <button mat-icon-button type="button" aria-label="Phóng to" matTooltip="Phóng to" (click)="zoom(zoomStep)"><mat-icon>zoom_in</mat-icon></button>
      <button mat-icon-button type="button" aria-label="Vừa khung" matTooltip="Vừa chiều rộng" (click)="fit()"><mat-icon>fit_screen</mat-icon></button>
    </div>
    @if (rendering()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div #viewport class="viewport">
      <canvas #canvas class="page" aria-label="Trang bản vẽ"></canvas>
    </div>
  `,
  styleUrl: './pdf-viewer.component.scss',
})
export class PdfViewerComponent implements OnDestroy {
  /** Nội dung file PDF. */
  readonly data = input.required<ArrayBuffer>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly viewportRef = viewChild.required<ElementRef<HTMLElement>>('viewport');

  protected readonly zoomStep = ZOOM_STEP;
  protected readonly page = signal(1);
  protected readonly pageCount = signal(0);
  /** null = vừa chiều rộng khung. */
  private readonly scale = signal<number | null>(null);
  private readonly appliedScale = signal(1);
  protected readonly rendering = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly percent = computed(() => Math.round(this.appliedScale() * 100));

  private readonly pdf = signal<PdfDocument | null>(null);
  /** Bỏ kết quả của lượt vẽ cũ khi người dùng thao tác nhanh. */
  private renderToken = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      const data = this.data();
      untracked(() => void this.open(data));
    });
    effect(() => {
      const pdf = this.pdf();
      const page = this.page();
      const scale = this.scale();
      if (pdf) {
        untracked(() => void this.render(pdf, page, scale));
      }
    });
  }

  ngOnDestroy(): void {
    closePdf(this.pdf());
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected zoom(factor: number): void {
    this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.appliedScale() * factor)));
  }

  protected fit(): void {
    this.scale.set(null);
  }

  private async open(data: ArrayBuffer): Promise<void> {
    this.error.set(null);
    this.rendering.set(true);
    try {
      const previous = this.pdf();
      const pdf = await openPdf(data);
      closePdf(previous);
      this.pageCount.set(pdf.numPages);
      this.page.set(1);
      this.pdf.set(pdf);
    } catch {
      this.rendering.set(false);
      this.error.set('Không mở được tệp PDF (tệp hỏng hoặc không đúng định dạng).');
    }
  }

  /**
   * pdf.js không cho vẽ chồng hai lượt lên cùng một canvas: xếp hàng các lượt vẽ,
   * lượt nào đã bị lượt mới hơn thay thế thì bỏ qua.
   */
  private render(pdf: PdfDocument, page: number, scale: number | null): Promise<void> {
    const token = ++this.renderToken;
    this.rendering.set(true);
    this.queue = this.queue.then(() => (token === this.renderToken ? this.draw(token, pdf, page, scale) : undefined));
    return this.queue;
  }

  private async draw(token: number, pdf: PdfDocument, page: number, scale: number | null): Promise<void> {
    try {
      // Trừ padding của khung xem để trang không bị tràn ngang.
      const width = this.viewportRef().nativeElement.clientWidth - 24;
      const target = scale ?? (await fitWidthScale(pdf, page, width));
      if (token !== this.renderToken) {
        return;
      }
      await renderPage(pdf, page, target, this.canvas().nativeElement);
      if (token === this.renderToken) {
        this.appliedScale.set(target);
      }
    } catch {
      if (token === this.renderToken) {
        this.error.set('Không hiển thị được trang này.');
      }
    } finally {
      if (token === this.renderToken) {
        this.rendering.set(false);
      }
    }
  }
}
