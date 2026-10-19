import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import {
  Material,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MaterialCategory,
  MaterialUpsertRequest,
} from '../../models/material.model';

@Component({
  selector: 'app-material-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, VndPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data ? 'Sửa vật tư' : 'Thêm vật tư' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="material-form" class="form" (ngSubmit)="save()">
        <mat-form-field>
          <mat-label>Mã vật tư (nội dung mã QR)</mat-label>
          <input matInput formControlName="code" class="upper" maxlength="30" />
          @if (form.controls.code.hasError('required')) {
            <mat-error>Vui lòng nhập mã.</mat-error>
          } @else if (form.controls.code.hasError('pattern')) {
            <mat-error>2–30 ký tự: chữ in hoa, số, dấu chấm hoặc gạch ngang.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tên vật tư</mat-label>
          <input matInput formControlName="name" maxlength="200" />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Vui lòng nhập tên.</mat-error>
          }
        </mat-form-field>
        <div class="row">
          <mat-form-field>
            <mat-label>Nhóm</mat-label>
            <mat-select formControlName="category">
              @for (category of categories; track category) {
                <mat-option [value]="category">{{ categoryLabels[category] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Đơn vị tính</mat-label>
            <input matInput formControlName="unit" maxlength="20" />
            @if (form.controls.unit.hasError('required')) {
              <mat-error>Nhập ĐVT.</mat-error>
            }
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Đơn giá</mat-label>
          <input matInput type="number" min="0" formControlName="unitPrice" />
          <span matTextSuffix>₫</span>
          <mat-hint>{{ form.controls.unitPrice.value | vnd }}</mat-hint>
          @if (form.controls.unitPrice.invalid) {
            <mat-error>Đơn giá ≥ 0.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Mô tả</mat-label>
          <textarea matInput rows="2" formControlName="description" maxlength="1000"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="material-form">Lưu</button>
    </mat-dialog-actions>
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
  protected readonly data = inject<Material | null>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MaterialFormDialogComponent, MaterialUpsertRequest>>(MatDialogRef);
  protected readonly categories = MATERIAL_CATEGORIES;
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;

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
