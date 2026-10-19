import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Material, StockItem, StockTransactionType } from '../../models/material.model';

export interface StockMovementDialogData {
  readonly type: StockTransactionType;
  readonly materials: readonly Material[];
  readonly stock: readonly StockItem[];
  readonly materialId?: string;
}

export interface StockMovementResult {
  readonly type: StockTransactionType;
  readonly materialId: string;
  readonly quantity: number;
  readonly note: string;
}

@Component({
  selector: 'app-stock-movement-dialog',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Phiếu {{ type() === 'IN' ? 'nhập' : 'xuất' }} kho</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="movement-form" class="form" (ngSubmit)="save()">
        <mat-button-toggle-group formControlName="type" hideSingleSelectionIndicator class="type" aria-label="Loại phiếu">
          <mat-button-toggle value="IN"><mat-icon>south</mat-icon> Nhập kho</mat-button-toggle>
          <mat-button-toggle value="OUT"><mat-icon>north</mat-icon> Xuất kho</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field>
          <mat-label>Vật tư</mat-label>
          <mat-select formControlName="materialId">
            @for (material of data.materials; track material.id) {
              <mat-option [value]="material.id">{{ material.code }} · {{ material.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.materialId.hasError('required')) {
            <mat-error>Vui lòng chọn vật tư.</mat-error>
          }
        </mat-form-field>

        @if (material(); as material) {
          <p class="current">
            Tồn hiện tại: <strong>{{ currentStock() | number: '1.0-2' }} {{ material.unit }}</strong>
            @if (stockItem()?.isLow) {
              <span class="low">· dưới mức tối thiểu ({{ stockItem()?.minQuantity | number }})</span>
            }
          </p>
        }

        <mat-form-field>
          <mat-label>Số lượng</mat-label>
          <input matInput type="number" min="0" step="any" formControlName="quantity" />
          <span matTextSuffix>{{ material()?.unit }}</span>
          @if (form.controls.quantity.hasError('required')) {
            <mat-error>Vui lòng nhập số lượng.</mat-error>
          } @else if (form.controls.quantity.hasError('min')) {
            <mat-error>Số lượng phải lớn hơn 0.</mat-error>
          }
        </mat-form-field>
        @if (form.hasError('exceedsStock')) {
          <p class="error" role="alert">Không đủ tồn kho để xuất.</p>
        }

        <mat-form-field>
          <mat-label>{{ type() === 'IN' ? 'Nguồn nhập / ghi chú' : 'Xuất cho hạng mục / tổ đội' }}</mat-label>
          <input matInput formControlName="note" maxlength="300" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="movement-form">{{ type() === 'IN' ? 'Nhập kho' : 'Xuất kho' }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(420px, 100%);
      padding-top: 4px;
    }
    .type {
      align-self: flex-start;
      margin-bottom: 12px;
    }
    .current {
      margin: -8px 0 12px;
      font: var(--mat-sys-body-medium);
    }
    .low,
    .error {
      color: var(--mat-sys-error);
    }
    .error {
      margin: -8px 0 8px;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class StockMovementDialogComponent {
  protected readonly data = inject<StockMovementDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<StockMovementDialogComponent, StockMovementResult>>(MatDialogRef);

  protected readonly form = new FormGroup(
    {
      type: new FormControl<StockTransactionType>(this.data.type, { nonNullable: true }),
      materialId: new FormControl(this.data.materialId ?? '', { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
      note: new FormControl('', { nonNullable: true }),
    },
    { validators: (group) => this.stockValidator(group) },
  );

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly type = computed(() => this.value().type ?? 'IN');
  protected readonly material = computed(() => this.data.materials.find((item) => item.id === this.value().materialId) ?? null);
  protected readonly stockItem = computed(() => this.data.stock.find((item) => item.material.id === this.value().materialId) ?? null);
  protected readonly currentStock = computed(() => this.stockItem()?.quantity ?? 0);

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({ type: value.type, materialId: value.materialId, quantity: value.quantity ?? 0, note: value.note.trim() });
  }

  private stockValidator(group: AbstractControl): ValidationErrors | null {
    const value = (group as typeof this.form).getRawValue();
    if (value.type !== 'OUT' || value.quantity === null) {
      return null;
    }
    const current = this.data.stock.find((item) => item.material.id === value.materialId)?.quantity ?? 0;
    return value.quantity > current ? { exceedsStock: true } : null;
  }
}
