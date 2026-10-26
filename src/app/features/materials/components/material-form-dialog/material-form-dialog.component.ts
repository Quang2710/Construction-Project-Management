import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import {
  Material,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MaterialCategory,
  MaterialUpsertRequest,
} from '../../models/material.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { ButtonModule } from 'primeng/button';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { toOptions } from '../../../../shared/utils/options';

@Component({
  selector: 'app-material-form-dialog',
  imports: [
    ReactiveFormsModule,
    VndPipe,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>{{ data ? 'Sửa vật tư' : 'Thêm vật tư' }}</h2>
    <div dialogContent>
      <form [formGroup]="form" id="material-form" class="form" (ngSubmit)="save()">
        <app-field>
          <label fieldLabel>Mã vật tư (nội dung mã QR)</label>
          <input pInputText formControlName="code" class="upper" maxlength="30" />
          @if (form.controls.code.hasError('required')) {
            <app-error>Vui lòng nhập mã.</app-error>
          } @else if (form.controls.code.hasError('pattern')) {
            <app-error>2–30 ký tự: chữ in hoa, số, dấu chấm hoặc gạch ngang.</app-error>
          }
        </app-field>
        <app-field>
          <label fieldLabel>Tên vật tư</label>
          <input pInputText formControlName="name" maxlength="200" />
          @if (form.controls.name.hasError('required')) {
            <app-error>Vui lòng nhập tên.</app-error>
          }
        </app-field>
        <div class="row">
          <app-field>
            <label fieldLabel>Nhóm</label>
            <p-select formControlName="category" [options]="categoryOptions" optionLabel="label" optionValue="value" placeholder="Chọn…" [fluid]="true" />
          </app-field>
          <app-field>
            <label fieldLabel>Đơn vị tính</label>
            <input pInputText formControlName="unit" maxlength="20" />
            @if (form.controls.unit.hasError('required')) {
              <app-error>Nhập ĐVT.</app-error>
            }
          </app-field>
        </div>
        <app-field>
          <label fieldLabel>Đơn giá</label>
          <input pInputText type="number" min="0" formControlName="unitPrice" />
          <span fieldSuffix>₫</span>
          <small fieldHint>{{ form.controls.unitPrice.value | vnd }}</small>
          @if (form.controls.unitPrice.invalid) {
            <app-error>Đơn giá ≥ 0.</app-error>
          }
        </app-field>
        <app-field>
          <label fieldLabel>Mô tả</label>
          <textarea pTextarea rows="2" formControlName="description" maxlength="1000"></textarea>
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="material-form">Lưu</button>
    </div>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      min-width: min(440px, 100%);
      padding-top: 4px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 12px;
    }
    .upper {
      text-transform: uppercase;
    }
  `,
})
export class MaterialFormDialogComponent {
  protected readonly data = injectDialogData<Material | null>();
  private readonly dialogRef = injectDialogRef<MaterialUpsertRequest>();
  protected readonly categories = MATERIAL_CATEGORIES;
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;
  protected readonly categoryOptions = toOptions(this.categories, this.categoryLabels);

  protected readonly form = new FormGroup({
    code: new FormControl(this.data?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9.\-]{1,29}$/)],
    }),
    name: new FormControl(this.data?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    category: new FormControl<MaterialCategory>(this.data?.category ?? 'OTHER', { nonNullable: true }),
    unit: new FormControl(this.data?.unit ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    unitPrice: new FormControl<number | null>(this.data?.unitPrice ?? null, [Validators.required, Validators.min(0)]),
    description: new FormControl(this.data?.description ?? '', { nonNullable: true }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      category: value.category,
      unit: value.unit.trim(),
      unitPrice: value.unitPrice ?? 0,
      description: value.description.trim(),
    });
  }
}
