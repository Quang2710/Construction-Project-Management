import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { divIcon, LatLngBounds, LayerGroup, layerGroup, Map as LeafletMap, map, marker, tileLayer } from 'leaflet';

export interface MapMarker {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly title: string;
  /** Màu ghim (CSS color). */
  readonly color?: string;
}

export interface MapPoint {
  readonly lat: number;
  readonly lng: number;
}

/** Tâm mặc định: toàn lãnh thổ Việt Nam. */
const VIETNAM_CENTER: [number, number] = [16.2, 106.3];
const VIETNAM_ZOOM = 5;
const DETAIL_ZOOM = 15;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Bản đồ Leaflet (OpenStreetMap). Dùng divIcon thay ảnh ghim mặc định để không phụ thuộc asset.
 * editable = true: bấm lên bản đồ để chọn vị trí (phát ra locationPick).
 */
@Component({
  selector: 'app-project-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #container class="map" [class.map--editable]="editable()"></div>`,
  styles: `
    :host {
      display: block;
      height: 320px;
      border-radius: var(--mat-sys-corner-medium);
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .map {
      width: 100%;
      height: 100%;
    }
    .map--editable {
      cursor: crosshair;
    }
  `,
})
export class ProjectMapComponent {
  readonly markers = input<readonly MapMarker[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly editable = input(false);

  readonly markerClick = output<string>();
  readonly locationPick = output<MapPoint>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly mapInstance = signal<LeafletMap | null>(null);
  private markerLayer: LayerGroup | null = null;
  private lastFittedKey = '';

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const element = this.container().nativeElement;
      const instance = map(element, { center: VIETNAM_CENTER, zoom: VIETNAM_ZOOM, zoomControl: true });
      tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(instance);
      this.markerLayer = layerGroup().addTo(instance);
      instance.on('click', (event) => {
        if (this.editable()) {
          this.locationPick.emit({ lat: event.latlng.lat, lng: event.latlng.lng });
        }
      });

      // Bản đồ nằm trong tab/flex có thể đổi kích thước sau khi khởi tạo.
      const resizeObserver = new ResizeObserver(() => instance.invalidateSize());
      resizeObserver.observe(element);
      destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        instance.remove();
      });
      this.mapInstance.set(instance);
    });

    effect(() => {
      const instance = this.mapInstance();
      const markers = this.markers();
      const selectedId = this.selectedId();
      if (instance && this.markerLayer) {
        this.renderMarkers(instance, this.markerLayer, markers, selectedId);
      }
    });
  }

  private renderMarkers(
    instance: LeafletMap,
    layer: LayerGroup,
    markers: readonly MapMarker[],
    selectedId: string | null,
  ): void {
    layer.clearLayers();
    for (const item of markers) {
      const selected = item.id === selectedId;
      const icon = divIcon({
        className: 'map-pin',
        html: `<span class="map-pin__dot${selected ? ' map-pin__dot--selected' : ''}" style="--pin-color:${item.color ?? '#c2410c'}"></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26],
      });
      marker([item.lat, item.lng], { icon, title: item.title, zIndexOffset: selected ? 1000 : 0 })
        .bindTooltip(escapeHtml(item.title), { direction: 'top', offset: [0, -26] })
        .on('click', () => this.markerClick.emit(item.id))
        .addTo(layer);
    }

    // Chỉ căn lại khung nhìn khi tập marker thay đổi, không phải khi đổi lựa chọn.
    const key = markers.map((item) => `${item.id}:${item.lat}:${item.lng}`).join('|');
    if (key === this.lastFittedKey) {
      const selected = markers.find((item) => item.id === selectedId);
      if (selected) {
        instance.panTo([selected.lat, selected.lng]);
      }
      return;
    }
    this.lastFittedKey = key;
    if (markers.length === 1) {
      // Khi đang chọn vị trí, giữ mức zoom người dùng đã phóng to.
      const zoom = this.editable() && instance.getZoom() >= 10 ? instance.getZoom() : DETAIL_ZOOM;
      instance.setView([markers[0].lat, markers[0].lng], zoom);
    } else if (markers.length > 1) {
      const bounds = new LatLngBounds(markers.map((item) => [item.lat, item.lng] as [number, number]));
      instance.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
    }
  }
}
