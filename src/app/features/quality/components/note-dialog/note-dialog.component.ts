import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

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
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    TextareaModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>{{ data.title }}</h2>
    <div dialogContent>
      <p class="subtitle">{{ data.subtitle }}</p>
      <app-field class="field">
        <label fieldLabel>{{ data.label }}</label>
        <textarea pTextarea [formControl]="note" rows="4" maxlength="1000"></textarea>
        @if (note.hasError('required')) {
          <app-error>{{ data.requiredMessage ?? 'Vui lòng nhập lý do.' }}</app-error>
        }
      </app-field>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" [severity]="data.destructive ? 'danger' : undefined\" (click)="confirm()">{{ data.confirmText }}</button>
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
export class NoteDialogComponent {
  protected readonly data = injectDialogData<NoteDialogData>();
  private readonly dialogRef = injectDialogRef<string>();

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
