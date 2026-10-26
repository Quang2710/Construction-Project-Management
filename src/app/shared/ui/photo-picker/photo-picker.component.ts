import { ChangeDetectionStrategy, Component, input, OnDestroy, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface PickedPhoto {
  readonly file: File;
  readonly url: string;
}

/**
 * Chọn / chụp ảnh và xem trước (object URL), chưa tải lên.
 * Phát `filesChange` mỗi khi danh sách thay đổi; nơi dùng tự tải lên khi lưu.
 */
@Component({
  selector: 'app-photo-picker',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions">
      <button mat-stroked-button type="button" [disabled]="disabled() || photos().length >= max()" (click)="camera.click()">
        <mat-icon>photo_camera</mat-icon> Chụp ảnh
      </button>
      <button mat-stroked-button type="button" [disabled]="disabled() || photos().length >= max()" (click)="gallery.click()">
        <mat-icon>add_photo_alternate</mat-icon> Chọn ảnh
      </button>
      <span class="hint">{{ photos().length }}/{{ max() }} ảnh</span>
      <input #camera hidden type="file" accept="image/*" capture="environment" (change)="onFiles(camera)" />
      <input #gallery hidden type="file" accept="image/*" multiple (change)="onFiles(gallery)" />
    </div>
    @if (photos().length) {
      <ul class="grid">
        @for (photo of photos(); track photo.url; let index = $index) {
          <li class="thumb">
            <img [src]="photo.url" [alt]="photo.file.name" />
            <button
              mat-icon-button
              class="remove"
              type="button"
              [disabled]="disabled()"
              [attr.aria-label]="'Bỏ ảnh ' + photo.file.name"
              (click)="remove(index)"
            >
              <mat-icon>close</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 8px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .thumb {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .remove {
      position: absolute;
      top: 2px;
      right: 2px;
      --mat-icon-button-state-layer-size: 32px;
      width: 32px;
      height: 32px;
      padding: 4px;
      background: rgb(0 0 0 / 0.55);
      color: #fff;
    }
  `,
})
export class PhotoPickerComponent implements OnDestroy {
  readonly max = input(10);
  readonly disabled = input(false);
  readonly filesChange = output<File[]>();

  protected readonly photos = signal<PickedPhoto[]>([]);

  protected onFiles(element: HTMLInputElement): void {
    const room = this.max() - this.photos().length;
    const files = Array.from(element.files ?? [])
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(0, room));
    element.value = '';
    if (files.length) {
      this.photos.update((photos) => [...photos, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      this.emit();
    }
  }

  protected remove(index: number): void {
    const photo = this.photos()[index];
    if (photo) {
      URL.revokeObjectURL(photo.url);
    }
    this.photos.update((photos) => photos.filter((_, i) => i !== index));
    this.emit();
  }

  ngOnDestroy(): void {
    this.photos().forEach((photo) => URL.revokeObjectURL(photo.url));
  }

  private emit(): void {
    this.filesChange.emit(this.photos().map((photo) => photo.file));
  }
}
