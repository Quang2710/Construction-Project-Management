import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { COST_CATEGORIES, COST_CATEGORY_LABELS, CostCategory, CostEntryCreate, CostItemSummary } from '../../models/cost.model';

export interface CostEntryDialogData {
  readonly projectCode: string;
  readonly items: readonly CostItemSummary[];
}

/** Ghi nhận một chứng từ chi phí thực tế. Trả về CostEntryCreate, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-cost-entry-dialog',
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
    <h2 mat-dialog-title>Ghi nhận chi phí · {{ data.projectCode }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="cost-entry-form" class="form" (ngSubmit)="save()">
        <mat-form-field class="full">
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
          <mat-label>Loại chi phí</mat-label>
          <mat-select formControlName="category">
            @for (category of categories; track category) {
              <mat-option [value]="category">{{ categoryLabels[category] }}</mat-option>
            }
          </mat-select>
          @if (form.controls.category.hasError('required')) {
            <mat-error>Vui lòng chọn loại chi phí.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Ngày chứng từ</mat-label>
          <input matInput [matDatepicker]="picker" [max]="today" formControlName="date" placeholder="dd/MM/yyyy" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.date.hasError('matDatepickerParse')) {
            <mat-error>Ngày không đúng định dạng dd/MM/yyyy.</mat-error>
          } @else if (form.controls.date.hasError('required')) {
            <mat-error>Vui lòng chọn ngày chứng từ.</mat-error>
          } @else if (form.controls.date.hasError('matDatepickerMax')) {
            <mat-error>Ngày chứng từ không được ở tương lai.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Nội dung chi</mat-label>
          <input matInput formControlName="description" maxlength="300" />
          @if (form.controls.description.hasError('required') || form.controls.description.hasError('pattern')) {
            <mat-error>Vui lòng nhập nội dung chi.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Số tiền</mat-label>
          <input matInput type="number" min="0" step="1000" formControlName="amount" />
          <span matTextSuffix>₫</span>
          @if (form.controls.amount.hasError('required')) {
            <mat-error>Vui lòng nhập số tiền.</mat-error>
          } @else if (form.controls.amount.hasError('min')) {
            <mat-error>Số tiền phải lớn hơn 0.</mat-error>
          } @else if (form.controls.amount.hasError('max')) {
            <mat-error>Số tiền vượt quá giới hạn cho phép.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Số chứng từ / hoá đơn</mat-label>
          <input matInput formControlName="documentNo" maxlength="50" />
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Nhà cung cấp / đơn vị nhận tiền</mat-label>
          <input matInput formControlName="vendor" maxlength="200" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="cost-entry-form">Ghi nhận</button>
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
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class CostEntryDialogComponent {
  protected readonly data = inject<CostEntryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CostEntryDialogComponent, CostEntryCreate>>(MatDialogRef);

  protected readonly categories = COST_CATEGORIES;
  protected readonly categoryLabels = COST_CATEGORY_LABELS;
  protected readonly today = new Date();

  protected readonly form = new FormGroup({
    costItemId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl<CostCategory | null>(null, [Validators.required]),
    date: new FormControl<Date | null>(new Date(), [Validators.required]),
    // pattern: không chấp nhận chuỗi chỉ có khoảng trắng.
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)],
    }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(1e13)]),
    documentNo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    vendor: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.category || !value.date || value.amount === null) {
      return;
    }
    this.dialogRef.close({
      costItemId: value.costItemId,
      category: value.category,
      date: toIsoDate(value.date),
      description: value.description.trim(),
      amount: Math.round(value.amount),
      documentNo: value.documentNo.trim(),
      vendor: value.vendor.trim(),
    });
  }
}
