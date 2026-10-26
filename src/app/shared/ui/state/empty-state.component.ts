import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-icon class="icon">{{ icon() }}</app-icon>
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
