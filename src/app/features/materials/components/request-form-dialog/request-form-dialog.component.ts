import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { addDays } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { Material, MaterialRequestCreate } from '../../models/material.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { minDateValidator } from '../../../../shared/utils/date-validators';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

export interface RequestFormDialogData {
  readonly projectCode: string;
  readonly materials: readonly Material[];
  /** Điền sẵn (ví dụ từ danh sách vật tư dưới mức tối thiểu). */
  readonly prefill?: readonly { readonly materialId: string; readonly quantity: number }[];
}

export type RequestFormResult = Omit<MaterialRequestCreate, 'projectId'>;

interface ItemForm {
  materialId: FormControl<string>;
  quantity: FormControl<number | null>;
}

function itemGroup(materialId = '', quantity: number | null = null): FormGroup<ItemForm> {
  return new FormGroup<ItemForm>({
    materialId: new FormControl(materialId, { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(quantity, [Validators.required, Validators.min(0.0001)]),
  });
}

@Component({
  selector: 'app-request-form-dialog',
  imports: [
    MutablePipe,
    ReactiveFormsModule,
    VndPipe,
    ButtonModule,
    IconComponent,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-form-dialog.component.html',
  styleUrl: './request-form-dialog.component.scss',
})
export class RequestFormDialogComponent {
  protected readonly data = injectDialogData<RequestFormDialogData>();
  private readonly dialogRef = injectDialogRef<RequestFormResult>();
  protected readonly today = new Date();

  protected readonly form = new FormGroup({
    items: new FormArray<FormGroup<ItemForm>>(
      this.data.prefill?.length
        ? this.data.prefill.map((item) => itemGroup(item.materialId, item.quantity))
        : [itemGroup()],
    ),
    neededBy: new FormControl<Date | null>(addDays(new Date(), 3), [Validators.required, minDateValidator(this.today)]),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly duplicate = computed(() => {
    const ids = (this.value().items ?? []).map((item) => item.materialId).filter(Boolean);
    return new Set(ids).size !== ids.length;
  });
  protected readonly total = computed(() =>
    (this.value().items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0) * (this.materialOf(item.materialId ?? '')?.unitPrice ?? 0), 0),
  );

  protected materialOf(id: string): Material | undefined {
    return this.data.materials.find((material) => material.id === id);
  }

  protected addItem(): void {
    this.form.controls.items.push(itemGroup());
  }

  protected removeItem(index: number): void {
    this.form.controls.items.removeAt(index);
  }

  protected save(): void {
    if (this.form.invalid || this.duplicate() || this.form.controls.items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      items: value.items.map((item) => ({ materialId: item.materialId, quantity: item.quantity ?? 0 })),
      neededBy: value.neededBy ? toIsoDate(value.neededBy) : toIsoDate(new Date()),
      note: value.note.trim(),
    });
  }
}
