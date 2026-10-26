import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface NoteDialogData {
  readonly title: string;
  readonly subtitle: string;
  readonly label: string;
  readonly confirmText: string;
  /** Bắt buộc nhập (lý do trả lại / mở lại). */
  readonly required: boolean;
  readonly requiredMessage?: string;
  readonly destructive?: boolean;
}

/** Hộp thoại nhập ý kiến khi duyệt / trả lại / mở lại. Trả về ghi chú, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-note-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="subtitle">{{ data.subtitle }}</p>
      <mat-form-field class="field">
        <mat-label>{{ data.label }}</mat-label>
        <textarea matInput [formControl]="note" rows="4" maxlength="1000" cdkFocusInitial></textarea>
        @if (note.hasError('required')) {
          <mat-error>{{ data.requiredMessage ?? 'Vui lòng nhập lý do.' }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" [class.danger]="data.destructive" (click)="confirm()">{{ data.confirmText }}</button>
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
export class NoteDialogComponent {
  protected readonly data = inject<NoteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<NoteDialogComponent, string>>(MatDialogRef);

  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: this.data.required ? [Validators.required, Validators.maxLength(1000)] : [Validators.maxLength(1000)],
  });

  protected confirm(): void {
    if (this.note.invalid || (this.data.required && !this.note.value.trim())) {
      this.note.setErrors({ required: true });
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close(this.note.value.trim());
  }
}
