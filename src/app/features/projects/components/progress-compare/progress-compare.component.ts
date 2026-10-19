import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Thanh tiến độ thực tế, có vạch đánh dấu % kế hoạch. */
@Component({
  selector: 'app-progress-compare',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.delayed]': 'delayed()', '[class.compact]': 'compact()' },
  template: `
    <div
      class="track"
      role="progressbar"
      [attr.aria-valuenow]="actual()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="'Thực tế ' + actual() + '%, kế hoạch ' + planned() + '%'"
    >
      <div class="fill" [style.width.%]="actual()"></div>
      <div class="marker" [style.left.%]="planned()"></div>
    </div>
    @if (!compact()) {
      <div class="legend">
        <span class="legend__actual">Thực tế {{ actual() }}%</span>
        <span class="legend__planned">Kế hoạch {{ planned() }}%</span>
      </div>
    } @else {
      <span class="value">{{ actual() }}%</span>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 96px;
    }
    :host(.compact) {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .track {
      position: relative;
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
    }
    .fill {
      height: 100%;
      border-radius: inherit;
      background: var(--mat-sys-primary);
      transition: width 300ms ease;
    }
    :host(.delayed) .fill {
      background: var(--mat-sys-error);
    }
    .marker {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 14px;
      margin-left: -1px;
      background: var(--mat-sys-on-surface);
    }
    .legend {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font: var(--mat-sys-body-small);
    }
    .legend__planned {
      color: var(--mat-sys-on-surface-variant);
    }
    .value {
      min-width: 36px;
      font: var(--mat-sys-label-medium);
      text-align: right;
    }
  `,
})
export class ProgressCompareComponent {
  readonly actual = input.required<number>();
  readonly planned = input.required<number>();
  readonly compact = input(false);

  protected readonly delayed = computed(() => this.planned() - this.actual() >= 10);
}
