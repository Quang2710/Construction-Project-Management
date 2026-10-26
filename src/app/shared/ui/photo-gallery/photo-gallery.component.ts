import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Photo } from '../../models/photo.model';
import { distanceMeters, formatDistance } from '../../utils/geo.utils';
import { PhotoLightboxComponent, PhotoLightboxData } from '../photo-lightbox/photo-lightbox.component';

interface GalleryItem {
  readonly photo: Photo;
  readonly distance: string | null;
  readonly far: boolean;
}

/** Lưới ảnh hiện trường; bấm để xem phóng to. */
@Component({
  selector: 'app-photo-gallery',
  imports: [MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid">
      @for (item of items(); track item.photo.id; let index = $index) {
        <li>
          <button type="button" class="thumb" (click)="open(index)" [attr.aria-label]="'Xem ảnh ' + (item.photo.caption || item.photo.fileName)">
            <img [src]="item.photo.url" [alt]="item.photo.caption || item.photo.fileName" loading="lazy" />
            @if (item.distance) {
              <span class="gps" [class.gps--far]="item.far" [matTooltip]="item.far ? 'Chụp cách xa công trình' : 'Vị trí chụp'">
                <mat-icon>{{ item.far ? 'wrong_location' : 'location_on' }}</mat-icon>{{ item.distance }}
              </span>
            }
          </button>
          <p class="caption">{{ item.photo.caption || item.photo.fileName }}</p>
        </li>
      }
    </ul>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .thumb {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-high);
      cursor: zoom-in;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 200ms ease;
    }
    .thumb:hover img,
    .thumb:focus-visible img {
      transform: scale(1.04);
    }
    .gps {
      position: absolute;
      left: 6px;
      bottom: 6px;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 8px 1px 4px;
      border-radius: 999px;
      background: rgb(0 0 0 / 0.6);
      color: #fff;
      font: var(--mat-sys-label-small);
    }
    .gps--far {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
    .gps mat-icon {
      width: 14px;
      height: 14px;
      font-size: 14px;
    }
    .caption {
      margin: 4px 0 0;
      overflow: hidden;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class PhotoGalleryComponent {
  private readonly dialog = inject(MatDialog);

  readonly photos = input.required<readonly Photo[]>();
  readonly site = input<{ lat: number; lng: number } | null>(null);

  protected readonly items = computed<GalleryItem[]>(() => {
    const site = this.site();
    return this.photos().map((photo) => {
      const meters = photo.location && site ? distanceMeters(photo.location, site) : null;
      return { photo, distance: meters === null ? null : formatDistance(meters), far: (meters ?? 0) > 1000 };
    });
  });

  protected open(index: number): void {
    this.dialog.open<PhotoLightboxComponent, PhotoLightboxData>(PhotoLightboxComponent, {
      data: { photos: this.photos(), index, site: this.site() },
      width: '1000px',
      maxWidth: 'calc(100vw - 16px)',
      panelClass: 'lightbox-panel',
      autoFocus: 'dialog',
    });
  }
}
