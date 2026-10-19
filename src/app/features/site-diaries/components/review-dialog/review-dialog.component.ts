import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ReviewDialogData {
  readonly mode: 'approve' | 'reject';
  readonly title: string;
}

/** Nhập ý kiến khi duyệt (tuỳ chọn) hoặc lý do trả lại (bắt buộc). Trả về ghi chú, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-review-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'approve' ? 'Duyệt nhật ký' : 'Trả lại nhật ký' }}</h2>
    <mat-dialog-content>
      <p class="subtitle">{{ data.title }}</p>
      <mat-form-field class="field">
        <mat-label>{{ data.mode === 'approve' ? 'Ý kiến (không bắt buộc)' : 'Lý do trả lại' }}</mat-label>
        <textarea matInput [formControl]="note" rows="4" maxlength="1000" cdkFocusInitial></textarea>
        @if (note.hasError('required')) {
          <mat-error>Vui lòng nhập lý do để người lập biết cần sửa gì.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" [class.danger]="data.mode === 'reject'" (click)="confirm()">
        {{ data.mode === 'approve' ? 'Phê duyệt' : 'Trả lại' }}
      </button>
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
    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ReviewDialogComponent {
  protected readonly data = inject<ReviewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ReviewDialogComponent, string>>(MatDialogRef);

  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: this.data.mode === 'reject' ? [Validators.required, Validators.maxLength(1000)] : [Validators.maxLength(1000)],
  });

  protected confirm(): void {
    if (this.note.invalid || (this.data.mode === 'reject' && !this.note.value.trim())) {
      this.note.setErrors({ required: true });
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close(this.note.value.trim());
  }
}
