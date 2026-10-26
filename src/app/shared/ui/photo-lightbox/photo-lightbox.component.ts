import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Photo } from '../../models/photo.model';
import { distanceMeters, formatDistance, osmUrl } from '../../utils/geo.utils';
import { injectDialogData, DialogCloseDirective } from '../dialog/app-dialog.service';
import { IconComponent } from '../icon/icon.component';

export interface PhotoLightboxData {
  readonly photos: readonly Photo[];
  readonly index: number;
  /** Vị trí công trình để tính khoảng cách nơi chụp. */
  readonly site: { readonly lat: number; readonly lng: number } | null;
}

@Component({
  selector: 'app-photo-lightbox',
  imports: [
    DatePipe,
    ButtonModule,
    IconComponent,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.arrowleft)': 'move(-1)', '(keydown.arrowright)': 'move(1)' },
  template: `
    @if (photo(); as photo) {
      <div class="viewer">
        <img class="viewer__image" [src]="photo.url" [alt]="photo.caption || photo.fileName" />
        @if (data.photos.length > 1) {
          <button pButton text rounded severity="secondary" class="nav nav--prev" type="button" aria-label="Ảnh trước" (click)="move(-1)">
            <app-icon pButtonIcon>chevron_left</app-icon>
          </button>
          <button pButton text rounded severity="secondary" class="nav nav--next" type="button" aria-label="Ảnh sau" (click)="move(1)">
            <app-icon pButtonIcon>chevron_right</app-icon>
          </button>
        }
        <button pButton text rounded severity="secondary" class="close" type="button" appDialogClose aria-label="Đóng">
          <app-icon pButtonIcon>close</app-icon>
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
            <app-icon>location_on</app-icon>
            {{ location.lat.toFixed(5) }}, {{ location.lng.toFixed(5) }}
            @if (distance(); as distance) {
              <span [class.far]="isFar()">· cách công trình {{ distance }}</span>
            }
          </a>
        } @else {
          <span class="meta__sub"><app-icon>location_off</app-icon> Không có GPS</span>
        }
      </div>
    }
  `,
  styleUrl: './photo-lightbox.component.scss',
})
export class PhotoLightboxComponent {
  protected readonly data = injectDialogData<PhotoLightboxData>();
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
