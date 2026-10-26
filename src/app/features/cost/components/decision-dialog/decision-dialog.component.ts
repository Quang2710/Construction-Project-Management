import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { ChangeOrder } from '../../models/cost.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

export interface DecisionDialogData {
  readonly mode: 'approve' | 'reject';
  readonly order: ChangeOrder;
}

/** Chấp thuận (ý kiến tuỳ chọn) / không chấp thuận (bắt buộc lý do) phát sinh. Trả về ghi chú, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-decision-dialog',
  imports: [
    ReactiveFormsModule,
    VndPipe,
    ButtonModule,
    ...FIELD,
    TextareaModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>{{ data.mode === 'approve' ? 'Chấp thuận phát sinh' : 'Không chấp thuận phát sinh' }}</h2>
    <div dialogContent>
      <p class="subtitle">{{ data.order.code }} · {{ data.order.title }}</p>
      @if (data.mode === 'approve') {
        <p class="impact">
          Dự toán hạng mục <strong>{{ data.order.costItemName }}</strong> tăng {{ data.order.costAmount | vnd }};
          giá trị hợp đồng tăng {{ data.order.revenueAmount | vnd }}.
        </p>
      }
      <app-field class="field">
        <label fieldLabel>{{ data.mode === 'approve' ? 'Ý kiến (không bắt buộc)' : 'Lý do không chấp thuận' }}</label>
        <textarea pTextarea [formControl]="note" rows="4" maxlength="1000"></textarea>
        @if (note.hasError('required')) {
          <app-error>Vui lòng nhập lý do không chấp thuận.</app-error>
        }
      </app-field>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" [severity]="data.mode === 'reject' ? 'danger' : undefined\" (click)="confirm()">
        {{ data.mode === 'approve' ? 'Chấp thuận' : 'Không chấp thuận' }}
      </button>
    </div>
  `,
  styles: `
    .subtitle {
      margin: 0 0 8px;
      font-weight: 500;
    }
    .impact {
      margin: 0 0 16px;
      color: var(--app-on-surface-variant);
    }
    .field {
      width: 100%;
    }
  `,
})
export class DecisionDialogComponent {
  protected readonly data = injectDialogData<DecisionDialogData>();
  private readonly dialogRef = injectDialogRef<string>();

  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: this.data.mode === 'reject' ? [Validators.required, Validators.maxLength(1000)] : [Validators.maxLength(1000)],
  });

  protected confirm(): void {
    if (this.note.invalid || (this.data.mode === 'reject' && !this.note.value.trim())) {
      this.note.setErrors({ required: true });
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close(this.note.value.trim());
  }
}
