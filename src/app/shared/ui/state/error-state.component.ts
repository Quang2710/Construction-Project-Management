import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-error-state',
  imports: [
    ButtonModule,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', class: 'error' },
  template: `
    <app-icon class="icon">error_outline</app-icon>
    <p class="title">{{ title() }}</p>
    <p class="message">{{ message() }}</p>
    <button pButton outlined type="button" (click)="retry.emit()">
      <app-icon>refresh</app-icon>
      Thử lại
    </button>
  `,
  styleUrl: './state.scss',
})
export class ErrorStateComponent {
  readonly title = input('Không tải được dữ liệu');
  readonly message = input('Đã có lỗi xảy ra. Vui lòng thử lại.');
  readonly retry = output<void>();
}
