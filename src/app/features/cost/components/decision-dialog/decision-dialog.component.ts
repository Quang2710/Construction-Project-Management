import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { ChangeOrder } from '../../models/cost.model';

export interface DecisionDialogData {
  readonly mode: 'approve' | 'reject';
  readonly order: ChangeOrder;
}

/** Chấp thuận (ý kiến tuỳ chọn) / không chấp thuận (bắt buộc lý do) phát sinh. Trả về ghi chú, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-decision-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'approve' ? 'Chấp thuận phát sinh' : 'Không chấp thuận phát sinh' }}</h2>
    <mat-dialog-content>
      <p class="subtitle">{{ data.order.code }} · {{ data.order.title }}</p>
      @if (data.mode === 'approve') {
        <p class="impact">
          Dự toán hạng mục <strong>{{ data.order.costItemName }}</strong> tăng {{ data.order.costAmount | vnd }};
          giá trị hợp đồng tăng {{ data.order.revenueAmount | vnd }}.
        </p>
      }
      <mat-form-field class="field">
        <mat-label>{{ data.mode === 'approve' ? 'Ý kiến (không bắt buộc)' : 'Lý do không chấp thuận' }}</mat-label>
        <textarea matInput [formControl]="note" rows="4" maxlength="1000" cdkFocusInitial></textarea>
        @if (note.hasError('required')) {
          <mat-error>Vui lòng nhập lý do không chấp thuận.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" [class.danger]="data.mode === 'reject'" (click)="confirm()">
        {{ data.mode === 'approve' ? 'Chấp thuận' : 'Không chấp thuận' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle {
      margin: 0 0 8px;
      font-weight: 500;
    }
    .impact {
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    .field {
      width: 100%;
    }
    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class DecisionDialogComponent {
  protected readonly data = inject<DecisionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DecisionDialogComponent, string>>(MatDialogRef);

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
