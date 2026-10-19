import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-error-state',
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', class: 'error' },
  template: `
    <mat-icon class="icon">error_outline</mat-icon>
    <p class="title">{{ title() }}</p>
    <p class="message">{{ message() }}</p>
    <button mat-stroked-button type="button" (click)="retry.emit()">
      <mat-icon>refresh</mat-icon>
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
