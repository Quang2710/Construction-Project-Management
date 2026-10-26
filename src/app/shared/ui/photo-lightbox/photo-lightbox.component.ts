import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Photo } from '../../models/photo.model';
import { distanceMeters, formatDistance, osmUrl } from '../../utils/geo.utils';

export interface PhotoLightboxData {
  readonly photos: readonly Photo[];
  readonly index: number;
  /** Vị trí công trình để tính khoảng cách nơi chụp. */
  readonly site: { readonly lat: number; readonly lng: number } | null;
}

@Component({
  selector: 'app-photo-lightbox',
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.arrowleft)': 'move(-1)', '(keydown.arrowright)': 'move(1)' },
  template: `
    @if (photo(); as photo) {
      <div class="viewer">
        <img class="viewer__image" [src]="photo.url" [alt]="photo.caption || photo.fileName" />
        @if (data.photos.length > 1) {
          <button mat-icon-button class="nav nav--prev" type="button" aria-label="Ảnh trước" (click)="move(-1)">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button mat-icon-button class="nav nav--next" type="button" aria-label="Ảnh sau" (click)="move(1)">
            <mat-icon>chevron_right</mat-icon>
          </button>
        }
        <button mat-icon-button class="close" type="button" mat-dialog-close aria-label="Đóng">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="meta">
        <div>
          <p class="meta__caption">{{ photo.caption || photo.fileName }}</p>
          <p class="meta__sub">
            {{ index() + 1 }}/{{ data.photos.length }} · Chụp lúc {{ photo.takenAt | date: 'HH:mm dd/MM/yyyy' }}
          </p>
        </div>
        @if (photo.location; as location) {
          <a class="meta__gps" [href]="mapUrl()" target="_blank" rel="noopener">
            <mat-icon>location_on</mat-icon>
            {{ location.lat.toFixed(5) }}, {{ location.lng.toFixed(5) }}
            @if (distance(); as distance) {
              <span [class.far]="isFar()">· cách công trình {{ distance }}</span>
            }
          </a>
        } @else {
          <span class="meta__sub"><mat-icon>location_off</mat-icon> Không có GPS</span>
        }
      </div>
    }
  `,
  styleUrl: './photo-lightbox.component.scss',
})
export class PhotoLightboxComponent {
  protected readonly data = inject<PhotoLightboxData>(MAT_DIALOG_DATA);
  protected readonly index = signal(this.data.index);
  protected readonly photo = computed(() => this.data.photos[this.index()] ?? null);

  private readonly meters = computed(() => {
    const location = this.photo()?.location;
    return location && this.data.site ? distanceMeters(location, this.data.site) : null;
  });
  protected readonly distance = computed(() => {
    const meters = this.meters();
    return meters === null ? null : formatDistance(meters);
  });
  /** Ảnh chụp cách công trình > 1 km: có thể không chụp tại hiện trường. */
  protected readonly isFar = computed(() => (this.meters() ?? 0) > 1000);
  protected readonly mapUrl = computed(() => {
    const location = this.photo()?.location;
    return location ? osmUrl(location.lat, location.lng) : '';
  });

  protected move(delta: number): void {
    const count = this.data.photos.length;
    this.index.update((index) => (index + delta + count) % count);
  }
}
