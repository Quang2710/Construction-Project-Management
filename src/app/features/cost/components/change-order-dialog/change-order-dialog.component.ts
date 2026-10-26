import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { ChangeOrderCreate, CostItemSummary } from '../../models/cost.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

export interface ChangeOrderDialogData {
  readonly projectCode: string;
  readonly items: readonly CostItemSummary[];
}

const MAX_AMOUNT = 1e13;

/** Lập đề xuất chi phí phát sinh. Trả về ChangeOrderCreate, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-change-order-dialog',
  imports: [
    MutablePipe,
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Đề xuất phát sinh · {{ data.projectCode }}</h2>
    <div dialogContent>
      <form [formGroup]="form" id="change-order-form" class="form" (ngSubmit)="save()">
        <app-field class="full">
          <label fieldLabel>Tên phát sinh</label>
          <input pInputText formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <app-error>Vui lòng nhập tên phát sinh.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Hạng mục</label>
          <p-select formControlName="costItemId" [options]="data.items | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-item>{{ item.code }} · {{ item.name }}</ng-template>
            <ng-template #item let-item>{{ item.code }} · {{ item.name }}</ng-template>
          </p-select>
          @if (form.controls.costItemId.hasError('required')) {
            <app-error>Vui lòng chọn hạng mục.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Ngày phát sinh</label>
          <p-datepicker formControlName="date" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [fluid]="true" />
          @if (form.controls.date.hasError('required')) {
            <app-error>Vui lòng chọn ngày phát sinh.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Chi phí thực hiện tăng thêm</label>
          <input pInputText type="number" min="0" step="1000000" formControlName="costAmount" />
          <span fieldSuffix>₫</span>
          <small fieldHint>Cộng vào dự toán hạng mục khi được chấp thuận</small>
          @if (form.controls.costAmount.hasError('required')) {
            <app-error>Vui lòng nhập chi phí phát sinh.</app-error>
          } @else if (form.controls.costAmount.hasError('min') || form.controls.costAmount.hasError('max')) {
            <app-error>Giá trị phải từ 0 đến 10 triệu tỷ.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Giá trị đề nghị chủ đầu tư thanh toán</label>
          <input pInputText type="number" min="0" step="1000000" formControlName="revenueAmount" />
          <span fieldSuffix>₫</span>
          <small fieldHint>Tăng giá trị hợp đồng khi được chấp thuận</small>
          @if (form.controls.revenueAmount.hasError('required')) {
            <app-error>Vui lòng nhập giá trị đề nghị thanh toán.</app-error>
          } @else if (form.controls.revenueAmount.hasError('min') || form.controls.revenueAmount.hasError('max')) {
            <app-error>Giá trị phải từ 0 đến 10 triệu tỷ.</app-error>
          }
        </app-field>

        <app-field class="full">
          <label fieldLabel>Mô tả, căn cứ phát sinh</label>
          <textarea pTextarea formControlName="description" rows="3" maxlength="2000"></textarea>
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="change-order-form">Gửi đề xuất</button>
    </div>
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
  protected readonly data = injectDialogData<ChangeOrderDialogData>();
  private readonly dialogRef = injectDialogRef<ChangeOrderCreate>();

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
