import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PaymentMilestone } from '../../models/cost.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

/** Ghi nhận chủ đầu tư đã thanh toán một đợt. Trả về số tiền thực nhận, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-payment-receipt-dialog',
  imports: [
    ReactiveFormsModule,
    VndPipe,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Ghi nhận thanh toán</h2>
    <div dialogContent>
      <p class="subtitle">Đợt {{ payment.order }} · {{ payment.name }}</p>
      <p class="meta">Giá trị đợt: <strong>{{ payment.amount | vnd }}</strong></p>
      <app-field class="field">
        <label fieldLabel>Số tiền thực nhận</label>
        <input pInputText type="number" min="0" [max]="payment.amount" step="1000000" [formControl]="amount" />
        <span fieldSuffix>₫</span>
        <small fieldHint>Có thể thấp hơn giá trị đợt nếu chủ đầu tư giữ lại bảo hành / tạm ứng</small>
        @if (amount.hasError('required')) {
          <app-error>Vui lòng nhập số tiền thực nhận.</app-error>
        } @else if (amount.hasError('min')) {
          <app-error>Số tiền phải lớn hơn 0.</app-error>
        } @else if (amount.hasError('max')) {
          <app-error>Không được vượt giá trị đợt thanh toán.</app-error>
        }
      </app-field>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" (click)="confirm()">Xác nhận đã thu</button>
    </div>
  `,
  styles: `
    .subtitle {
      margin: 0 0 4px;
      font-weight: 500;
    }
    .meta {
      margin: 0 0 16px;
      color: var(--app-on-surface-variant);
    }
    .field {
      width: 100%;
      margin-bottom: 12px;
    }
  `,
})
export class PaymentReceiptDialogComponent {
  protected readonly payment = injectDialogData<PaymentMilestone>();
  private readonly dialogRef = injectDialogRef<number>();

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
