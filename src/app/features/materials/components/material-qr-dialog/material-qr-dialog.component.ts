import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Material } from '../../models/material.model';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Nhãn QR để dán lên kệ/bãi vật tư; quét nhãn này để nhập/xuất nhanh. */
@Component({
  selector: 'app-material-qr-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Nhãn QR vật tư</h2>
    <mat-dialog-content class="content">
      @if (qr(); as src) {
        <img class="qr" [src]="src" [alt]="'Mã QR ' + data.code" width="220" height="220" />
      } @else {
        <mat-spinner diameter="40" />
      }
      <p class="code">{{ data.code }}</p>
      <p class="name">{{ data.name }} ({{ data.unit }})</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Đóng</button>
      <button mat-flat-button type="button" [disabled]="!qr()" (click)="print()"><mat-icon>print</mat-icon> In nhãn</button>
    </mat-dialog-actions>
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
      font: var(--mat-sys-title-medium);
      letter-spacing: 0.05em;
    }
    .name {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class MaterialQrDialogComponent {
  protected readonly data = inject<Material>(MAT_DIALOG_DATA);
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
