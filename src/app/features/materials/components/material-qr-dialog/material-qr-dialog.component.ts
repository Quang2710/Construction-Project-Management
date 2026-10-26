import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Material } from '../../models/material.model';
import { injectDialogData, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Nhãn QR để dán lên kệ/bãi vật tư; quét nhãn này để nhập/xuất nhanh. */
@Component({
  selector: 'app-material-qr-dialog',
  imports: [
    ButtonModule,
    IconComponent,
    ProgressSpinnerModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Nhãn QR vật tư</h2>
    <div dialogContent>
      @if (qr(); as src) {
        <img class="qr" [src]="src" [alt]="'Mã QR ' + data.code" width="220" height="220" />
      } @else {
        <p-progress-spinner strokeWidth="6" ariaLabel="Đang xử lý" style="width: 40px; height: 40px" />
      }
      <p class="code">{{ data.code }}</p>
      <p class="name">{{ data.name }} ({{ data.unit }})</p>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Đóng</button>
      <button pButton type="button" [disabled]="!qr()" (click)="print()"><app-icon>print</app-icon> In nhãn</button>
    </div>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 280px;
    }
    .qr {
      border-radius: 8px;
      background: #fff;
    }
    .code {
      margin: 8px 0 0;
      font: var(--app-title-medium);
      letter-spacing: 0.05em;
    }
    .name {
      margin: 0;
      color: var(--app-on-surface-variant);
    }
  `,
})
export class MaterialQrDialogComponent {
  protected readonly data = injectDialogData<Material>();
  private readonly document = inject(DOCUMENT);
  protected readonly qr = signal<string | null>(null);

  constructor() {
    void this.render();
  }

  protected print(): void {
    const src = this.qr();
    const popup = this.document.defaultView?.open('', '_blank', 'width=420,height=520');
    if (!src || !popup) {
      return;
    }
    popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(this.data.code)}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:20px;margin:8px 0 0}p{margin:4px 0}</style>
      </head><body><img src="${src}" width="260" height="260" alt=""><h1>${escapeHtml(this.data.code)}</h1>
      <p>${escapeHtml(this.data.name)} (${escapeHtml(this.data.unit)})</p></body></html>`);
    popup.document.close();
    popup.onload = () => popup.print();
  }

  private async render(): Promise<void> {
    const { toDataURL } = await import('qrcode');
    this.qr.set(await toDataURL(this.data.code, { width: 440, margin: 1, errorCorrectionLevel: 'M' }));
  }
}
