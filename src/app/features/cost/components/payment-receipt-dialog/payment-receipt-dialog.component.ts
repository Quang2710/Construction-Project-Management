import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PaymentMilestone } from '../../models/cost.model';

/** Ghi nhận chủ đầu tư đã thanh toán một đợt. Trả về số tiền thực nhận, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-payment-receipt-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Ghi nhận thanh toán</h2>
    <mat-dialog-content>
      <p class="subtitle">Đợt {{ payment.order }} · {{ payment.name }}</p>
      <p class="meta">Giá trị đợt: <strong>{{ payment.amount | vnd }}</strong></p>
      <mat-form-field class="field">
        <mat-label>Số tiền thực nhận</mat-label>
        <input matInput type="number" min="0" [max]="payment.amount" step="1000000" [formControl]="amount" cdkFocusInitial />
        <span matTextSuffix>₫</span>
        <mat-hint>Có thể thấp hơn giá trị đợt nếu chủ đầu tư giữ lại bảo hành / tạm ứng</mat-hint>
        @if (amount.hasError('required')) {
          <mat-error>Vui lòng nhập số tiền thực nhận.</mat-error>
        } @else if (amount.hasError('min')) {
          <mat-error>Số tiền phải lớn hơn 0.</mat-error>
        } @else if (amount.hasError('max')) {
          <mat-error>Không được vượt giá trị đợt thanh toán.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" (click)="confirm()">Xác nhận đã thu</button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle {
      margin: 0 0 4px;
      font-weight: 500;
    }
    .meta {
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .field {
      width: 100%;
      margin-bottom: 12px;
    }
  `,
})
export class PaymentReceiptDialogComponent {
  protected readonly payment = inject<PaymentMilestone>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PaymentReceiptDialogComponent, number>>(MatDialogRef);

  protected readonly amount = new FormControl<number | null>(this.payment.amount, [
    Validators.required,
    Validators.min(1),
    Validators.max(this.payment.amount),
  ]);

  protected confirm(): void {
    if (this.amount.invalid || this.amount.value === null) {
      this.amount.markAsTouched();
      return;
    }
    this.dialogRef.close(Math.round(this.amount.value));
  }
}
