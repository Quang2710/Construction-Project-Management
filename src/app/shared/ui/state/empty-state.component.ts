import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon class="icon">{{ icon() }}</mat-icon>
    <p class="title">{{ title() }}</p>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './state.scss',
})
export class EmptyStateComponent {
  readonly title = input('Không có dữ liệu');
  readonly message = input('');
  readonly icon = input('inbox');
}
