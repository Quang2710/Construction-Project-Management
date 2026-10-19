import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { WbsCreateRequest, WbsNode } from '../../models/wbs.model';

export interface WbsDialogData {
  readonly nodes: readonly WbsNode[];
}

@Component({
  selector: 'app-wbs-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Thêm hạng mục WBS</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="wbs-form" (ngSubmit)="save()" class="form">
        <mat-form-field>
          <mat-label>Tên hạng mục</mat-label>
          <input matInput formControlName="name" maxlength="200" cdkFocusInitial />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Vui lòng nhập tên hạng mục.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Thuộc hạng mục</mat-label>
          <mat-select formControlName="parentId">
            <mat-option [value]="null">— Cấp cao nhất —</mat-option>
            @for (node of data.nodes; track node.id) {
              <mat-option [value]="node.id">{{ node.code }}. {{ node.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="wbs-form">Thêm</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      min-width: min(380px, 100%);
      padding-top: 4px;
    }
  `,
})
export class WbsDialogComponent {
  protected readonly data = inject<WbsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<WbsDialogComponent, WbsCreateRequest>>(MatDialogRef);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    parentId: new FormControl<string | null>(null),
  });

  protected save(): void {
    if (this.form.invalid || !this.form.controls.name.value.trim()) {
      this.form.controls.name.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }
    const { name, parentId } = this.form.getRawValue();
    this.dialogRef.close({ name: name.trim(), parentId });
  }
}
