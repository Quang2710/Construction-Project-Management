import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StockItem } from '../../models/material.model';

@Component({
  selector: 'app-min-quantity-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Mức tồn tối thiểu</h2>
    <mat-dialog-content>
      <p class="subtitle">{{ data.material.code }} · {{ data.material.name }} ({{ data.projectCode }})</p>
      <mat-form-field class="field">
        <mat-label>Tồn tối thiểu</mat-label>
        <input matInput type="number" min="0" [formControl]="control" cdkFocusInitial (keydown.enter)="save()" />
        <span matTextSuffix>{{ data.material.unit }}</span>
        @if (control.invalid) {
          <mat-error>Nhập số ≥ 0.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" (click)="save()">Lưu</button>
    </mat-dialog-actions>
  `,
  styles: `
    .subtitle {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .field {
      width: 100%;
    }
  `,
})
export class MinQuantityDialogComponent {
  protected readonly data = inject<StockItem>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MinQuantityDialogComponent, number>>(MatDialogRef);
  protected readonly control = new FormControl<number | null>(this.data.minQuantity, [Validators.required, Validators.min(0)]);

  protected save(): void {
    if (this.control.invalid || this.control.value === null) {
      this.control.markAsTouched();
      return;
    }
    this.dialogRef.close(this.control.value);
  }
}
