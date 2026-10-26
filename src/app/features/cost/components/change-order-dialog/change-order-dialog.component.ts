import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { ChangeOrderCreate, CostItemSummary } from '../../models/cost.model';

export interface ChangeOrderDialogData {
  readonly projectCode: string;
  readonly items: readonly CostItemSummary[];
}

const MAX_AMOUNT = 1e13;

/** Lập đề xuất chi phí phát sinh. Trả về ChangeOrderCreate, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-change-order-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Đề xuất phát sinh · {{ data.projectCode }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="change-order-form" class="form" (ngSubmit)="save()">
        <mat-form-field class="full">
          <mat-label>Tên phát sinh</mat-label>
          <input matInput formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <mat-error>Vui lòng nhập tên phát sinh.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Hạng mục</mat-label>
          <mat-select formControlName="costItemId">
            @for (item of data.items; track item.id) {
              <mat-option [value]="item.id">{{ item.code }} · {{ item.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.costItemId.hasError('required')) {
            <mat-error>Vui lòng chọn hạng mục.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Ngày phát sinh</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="date" placeholder="dd/MM/yyyy" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.date.hasError('matDatepickerParse')) {
            <mat-error>Ngày không đúng định dạng dd/MM/yyyy.</mat-error>
          } @else if (form.controls.date.hasError('required')) {
            <mat-error>Vui lòng chọn ngày phát sinh.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Chi phí thực hiện tăng thêm</mat-label>
          <input matInput type="number" min="0" step="1000000" formControlName="costAmount" />
          <span matTextSuffix>₫</span>
          <mat-hint>Cộng vào dự toán hạng mục khi được chấp thuận</mat-hint>
          @if (form.controls.costAmount.hasError('required')) {
            <mat-error>Vui lòng nhập chi phí phát sinh.</mat-error>
          } @else if (form.controls.costAmount.hasError('min') || form.controls.costAmount.hasError('max')) {
            <mat-error>Giá trị phải từ 0 đến 10 triệu tỷ.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Giá trị đề nghị chủ đầu tư thanh toán</mat-label>
          <input matInput type="number" min="0" step="1000000" formControlName="revenueAmount" />
          <span matTextSuffix>₫</span>
          <mat-hint>Tăng giá trị hợp đồng khi được chấp thuận</mat-hint>
          @if (form.controls.revenueAmount.hasError('required')) {
            <mat-error>Vui lòng nhập giá trị đề nghị thanh toán.</mat-error>
          } @else if (form.controls.revenueAmount.hasError('min') || form.controls.revenueAmount.hasError('max')) {
            <mat-error>Giá trị phải từ 0 đến 10 triệu tỷ.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Mô tả, căn cứ phát sinh</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="change-order-form">Gửi đề xuất</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      padding-top: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
    mat-form-field:has(mat-hint) {
      margin-bottom: 12px;
    }
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ChangeOrderDialogComponent {
  protected readonly data = inject<ChangeOrderDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ChangeOrderDialogComponent, ChangeOrderCreate>>(MatDialogRef);

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    costItemId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl<Date | null>(new Date(), [Validators.required]),
    costAmount: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(MAX_AMOUNT)]),
    revenueAmount: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(MAX_AMOUNT)]),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.date || value.costAmount === null || value.revenueAmount === null) {
      return;
    }
    this.dialogRef.close({
      title: value.title.trim(),
      costItemId: value.costItemId,
      date: toIsoDate(value.date),
      costAmount: Math.round(value.costAmount),
      revenueAmount: Math.round(value.revenueAmount),
      description: value.description.trim(),
    });
  }
}
