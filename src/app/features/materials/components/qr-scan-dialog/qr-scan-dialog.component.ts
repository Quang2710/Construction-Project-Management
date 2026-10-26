import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';

export interface QrScanDialogData {
  /** Mã có sẵn trong danh mục, dùng cho nút "Mô phỏng quét". */
  readonly sampleCodes: readonly string[];
}

/** Kiểu tối thiểu của BarcodeDetector API (chưa có trong lib.dom của TypeScript). */
interface DetectedBarcode {
  readonly rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

type CameraState = 'starting' | 'scanning' | 'unsupported' | 'denied';

const SCAN_INTERVAL_MS = 300;

/**
 * Quét mã QR vật tư. Dùng camera + BarcodeDetector khi trình duyệt hỗ trợ (Chrome Android...),
 * luôn có ô nhập tay và nút mô phỏng quét để demo trên máy tính.
 */
@Component({
  selector: 'app-qr-scan-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    IconComponent,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Quét mã QR vật tư</h2>
    <div dialogContent>
      <div class="viewport">
        <video #video class="video" [class.video--hidden]="camera() !== 'scanning'" playsinline muted></video>
        @if (camera() === 'scanning') {
          <div class="frame" aria-hidden="true"></div>
        } @else {
          <div class="placeholder">
            <app-icon>qr_code_scanner</app-icon>
            <span>
              @switch (camera()) {
                @case ('starting') { Đang mở camera… }
                @case ('denied') { Không truy cập được camera. Hãy nhập mã hoặc mô phỏng quét. }
                @default { Trình duyệt chưa hỗ trợ quét QR. Hãy nhập mã hoặc mô phỏng quét. }
              }
            </span>
          </div>
        }
      </div>

      <form class="manual" (ngSubmit)="submitManual()">
        <app-field class="manual__field" dense>
          <label fieldLabel>Nhập mã vật tư</label>
          <input pInputText [formControl]="code" class="upper" placeholder="VD: TH-CB400-D16" />
        </app-field>
        <button pButton type="submit" [disabled]="!code.value.trim()">Tra cứu</button>
      </form>
    </div>
    <div dialogActions>
      <button pButton outlined type="button" [disabled]="!data.sampleCodes.length" (click)="simulate()">
        <app-icon>auto_awesome</app-icon> Mô phỏng quét
      </button>
      <span class="spacer"></span>
      <button pButton text type="button" appDialogClose>Đóng</button>
    </div>
  `,
  styles: `
    .viewport {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: min(420px, 100%);
      aspect-ratio: 4 / 3;
      margin: 0 auto 16px;
      overflow: hidden;
      border-radius: 12px;
      background: #000;
    }
    .video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video--hidden {
      display: none;
    }
    .frame {
      position: absolute;
      inset: 20%;
      border: 3px solid #fdba74;
      border-radius: 12px;
      box-shadow: 0 0 0 999px rgb(0 0 0 / 0.35);
    }
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #e5e5e5;
      text-align: center;
      app-icon {
        width: 48px;
        height: 48px;
        font-size: 48px;
      }
    }
    .manual {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .manual__field {
      flex: 1;
    }
    .upper {
      text-transform: uppercase;
    }
    .spacer {
      flex: 1;
    }
  `,
})
export class QrScanDialogComponent {
  protected readonly data = injectDialogData<QrScanDialogData>();
  private readonly dialogRef = injectDialogRef<string>();
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly camera = signal<CameraState>('starting');
  protected readonly code = new FormControl('', { nonNullable: true });

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    afterNextRender(() => void this.start());
  }

  protected submitManual(): void {
    const value = this.code.value.trim();
    if (value) {
      this.finish(value);
    }
  }

  protected simulate(): void {
    const codes = this.data.sampleCodes;
    this.finish(codes[Math.floor(Math.random() * codes.length)]);
  }

  private async start(): Promise<void> {
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      this.camera.set('unsupported');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camera.set('denied');
      return;
    }
    const video = this.video().nativeElement;
    video.srcObject = this.stream;
    await video.play();
    this.camera.set('scanning');
    const detector = new Detector({ formats: ['qr_code'] });

    const tick = async (): Promise<void> => {
      try {
        const [barcode] = await detector.detect(video);
        if (barcode?.rawValue) {
          this.finish(barcode.rawValue);
          return;
        }
      } catch {
        // Khung hình chưa sẵn sàng: thử lại ở lần sau.
      }
      this.timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
    };
    void tick();
  }

  private finish(code: string): void {
    this.stop();
    this.dialogRef.close(code.trim().toUpperCase());
  }

  private stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
