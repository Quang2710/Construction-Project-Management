import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { COST_CATEGORIES, COST_CATEGORY_LABELS, CostCategory, CostEntryCreate, CostItemSummary } from '../../models/cost.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { toOptions } from '../../../../shared/utils/options';
import { maxDateValidator } from '../../../../shared/utils/date-validators';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

export interface CostEntryDialogData {
  readonly projectCode: string;
  readonly items: readonly CostItemSummary[];
}

/** Ghi nhận một chứng từ chi phí thực tế. Trả về CostEntryCreate, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-cost-entry-dialog',
  imports: [
    MutablePipe,
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Ghi nhận chi phí · {{ data.projectCode }}</h2>
    <div dialogContent>
      <form [formGroup]="form" id="cost-entry-form" class="form" (ngSubmit)="save()">
        <app-field class="full">
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
          <label fieldLabel>Loại chi phí</label>
          <p-select formControlName="category" [options]="categoryOptions" optionLabel="label" optionValue="value" placeholder="Chọn…" [fluid]="true" />
          @if (form.controls.category.hasError('required')) {
            <app-error>Vui lòng chọn loại chi phí.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Ngày chứng từ</label>
          <p-datepicker [maxDate]="today" formControlName="date" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [fluid]="true" />
          @if (form.controls.date.hasError('required')) {
            <app-error>Vui lòng chọn ngày chứng từ.</app-error>
          } @else if (form.controls.date.hasError('maxDate')) {
            <app-error>Ngày chứng từ không được ở tương lai.</app-error>
          }
        </app-field>

        <app-field class="full">
          <label fieldLabel>Nội dung chi</label>
          <input pInputText formControlName="description" maxlength="300" />
          @if (form.controls.description.hasError('required') || form.controls.description.hasError('pattern')) {
            <app-error>Vui lòng nhập nội dung chi.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Số tiền</label>
          <input pInputText type="number" min="0" step="1000" formControlName="amount" />
          <span fieldSuffix>₫</span>
          @if (form.controls.amount.hasError('required')) {
            <app-error>Vui lòng nhập số tiền.</app-error>
          } @else if (form.controls.amount.hasError('min')) {
            <app-error>Số tiền phải lớn hơn 0.</app-error>
          } @else if (form.controls.amount.hasError('max')) {
            <app-error>Số tiền vượt quá giới hạn cho phép.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Số chứng từ / hoá đơn</label>
          <input pInputText formControlName="documentNo" maxlength="50" />
        </app-field>

        <app-field class="full">
          <label fieldLabel>Nhà cung cấp / đơn vị nhận tiền</label>
          <input pInputText formControlName="vendor" maxlength="200" />
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="cost-entry-form">Ghi nhận</button>
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
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class CostEntryDialogComponent {
  protected readonly data = injectDialogData<CostEntryDialogData>();
  private readonly dialogRef = injectDialogRef<CostEntryCreate>();

  protected readonly categories = COST_CATEGORIES;
  protected readonly categoryLabels = COST_CATEGORY_LABELS;
  protected readonly categoryOptions = toOptions(this.categories, this.categoryLabels);
  protected readonly today = new Date();

  protected readonly form = new FormGroup({
    costItemId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl<CostCategory | null>(null, [Validators.required]),
    date: new FormControl<Date | null>(new Date(), [Validators.required, maxDateValidator(this.today)]),
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
