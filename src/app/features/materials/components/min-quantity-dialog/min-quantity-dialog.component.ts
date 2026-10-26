import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { StockItem } from '../../models/material.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

@Component({
  selector: 'app-min-quantity-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Mức tồn tối thiểu</h2>
    <div dialogContent>
      <p class="subtitle">{{ data.material.code }} · {{ data.material.name }} ({{ data.projectCode }})</p>
      <app-field class="field">
        <label fieldLabel>Tồn tối thiểu</label>
        <input pInputText type="number" min="0" [formControl]="control" (keydown.enter)="save()" />
        <span fieldSuffix>{{ data.material.unit }}</span>
        @if (control.invalid) {
          <app-error>Nhập số ≥ 0.</app-error>
        }
      </app-field>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" (click)="save()">Lưu</button>
    </div>
  `,
  styles: `
    .subtitle {
      margin: 0 0 12px;
      color: var(--app-on-surface-variant);
    }
    .field {
      width: 100%;
    }
  `,
})
export class MinQuantityDialogComponent {
  protected readonly data = injectDialogData<StockItem>();
  private readonly dialogRef = injectDialogRef<number>();
  protected readonly control = new FormControl<number | null>(this.data.minQuantity, [Validators.required, Validators.min(0)]);

  protected save(): void {
    if (this.control.invalid || this.control.value === null) {
      this.control.markAsTouched();
      return;
    }
    this.dialogRef.close(this.control.value);
  }
}
