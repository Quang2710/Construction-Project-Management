import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ROLE_LABELS, UserSummary } from '../../../../shared/models/user.model';
import { parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';

export interface ReassignDialogData {
  readonly members: readonly UserSummary[];
  readonly assigneeId: string | null;
  /** yyyy-MM-dd */
  readonly dueDate: string;
}

export interface ReassignResult {
  readonly assigneeId: string;
  readonly dueDate: string;
}

@Component({
  selector: 'app-reassign-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Giao lại / đổi hạn</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="reassign-form" class="form" (ngSubmit)="save()">
        <mat-form-field>
          <mat-label>Người xử lý</mat-label>
          <mat-select formControlName="assigneeId">
            @for (member of data.members; track member.id) {
              <mat-option [value]="member.id">{{ member.fullName }} · {{ roleLabels[member.role] }}</mat-option>
            }
          </mat-select>
          @if (form.controls.assigneeId.hasError('required')) {
            <mat-error>Vui lòng chọn người xử lý.</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Hạn xử lý</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="dueDate" placeholder="dd/MM/yyyy" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.dueDate.hasError('matDatepickerParse')) {
            <mat-error>Ngày không đúng định dạng dd/MM/yyyy.</mat-error>
          } @else if (form.controls.dueDate.hasError('required')) {
            <mat-error>Vui lòng chọn hạn xử lý.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="reassign-form">Lưu</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(380px, 100%);
      padding-top: 4px;
    }
  `,
})
export class ReassignDialogComponent {
  protected readonly data = inject<ReassignDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ReassignDialogComponent, ReassignResult>>(MatDialogRef);
  protected readonly roleLabels = ROLE_LABELS;

  protected readonly form = new FormGroup({
    assigneeId: new FormControl(this.data.assigneeId ?? '', { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl<Date | null>(parseIsoDate(this.data.dueDate), [Validators.required]),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.dueDate) {
      this.dialogRef.close({ assigneeId: value.assigneeId, dueDate: toIsoDate(value.dueDate) });
    }
  }
}
