import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Material, StockItem, StockTransactionType } from '../../models/material.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

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
    MutablePipe,
    DecimalPipe,
    ReactiveFormsModule,
    SelectButtonModule,
    ButtonModule,
    IconComponent,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Phiếu {{ type() === 'IN' ? 'nhập' : 'xuất' }} kho</h2>
    <div dialogContent>
      <form [formGroup]="form" id="movement-form" class="form" (ngSubmit)="save()">
        <p-selectbutton
          formControlName="type"
          class="type"
          [options]="typeOptions | mutable"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [attr.aria-label]="'Loại phiếu'"
        >
          <ng-template #item let-option>
            <span class="type__option"><app-icon>{{ option.icon }}</app-icon> {{ option.label }}</span>
          </ng-template>
        </p-selectbutton>

        <app-field>
          <label fieldLabel>Vật tư</label>
          <p-select formControlName="materialId" [options]="data.materials | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-material>{{ material.code }} · {{ material.name }}</ng-template>
            <ng-template #item let-material>{{ material.code }} · {{ material.name }}</ng-template>
          </p-select>
          @if (form.controls.materialId.hasError('required')) {
            <app-error>Vui lòng chọn vật tư.</app-error>
          }
        </app-field>

        @if (material(); as material) {
          <p class="current">
            Tồn hiện tại: <strong>{{ currentStock() | number: '1.0-2' }} {{ material.unit }}</strong>
            @if (stockItem()?.isLow) {
              <span class="low">· dưới mức tối thiểu ({{ stockItem()?.minQuantity | number }})</span>
            }
          </p>
        }

        <app-field>
          <label fieldLabel>Số lượng</label>
          <input pInputText type="number" min="0" step="any" formControlName="quantity" />
          <span fieldSuffix>{{ material()?.unit }}</span>
          @if (form.controls.quantity.hasError('required')) {
            <app-error>Vui lòng nhập số lượng.</app-error>
          } @else if (form.controls.quantity.hasError('min')) {
            <app-error>Số lượng phải lớn hơn 0.</app-error>
          }
        </app-field>
        @if (form.hasError('exceedsStock')) {
          <p class="error" role="alert">Không đủ tồn kho để xuất.</p>
        }

        <app-field>
          <label fieldLabel>{{ type() === 'IN' ? 'Nguồn nhập / ghi chú' : 'Xuất cho hạng mục / tổ đội' }}</label>
          <input pInputText formControlName="note" maxlength="300" />
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="movement-form">{{ type() === 'IN' ? 'Nhập kho' : 'Xuất kho' }}</button>
    </div>
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
    .type__option {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .type__option app-icon {
      font-size: 18px;
    }
    .current {
      margin: -8px 0 12px;
      font: var(--app-body-medium);
    }
    .low,
    .error {
      color: var(--app-error);
    }
    .error {
      margin: -8px 0 8px;
      font: var(--app-body-small);
    }
  `,
})
export class StockMovementDialogComponent {
  protected readonly data = injectDialogData<StockMovementDialogData>();
  private readonly dialogRef = injectDialogRef<StockMovementResult>();

  protected readonly typeOptions: readonly { label: string; value: StockTransactionType; icon: string }[] = [
    { label: 'Nhập kho', value: 'IN', icon: 'south' },
    { label: 'Xuất kho', value: 'OUT', icon: 'north' },
  ];

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
