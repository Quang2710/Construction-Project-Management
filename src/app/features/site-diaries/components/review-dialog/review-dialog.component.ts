import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

export interface ReviewDialogData {
  readonly mode: 'approve' | 'reject';
  readonly title: string;
}

/** Nhập ý kiến khi duyệt (tuỳ chọn) hoặc lý do trả lại (bắt buộc). Trả về ghi chú, hoặc undefined nếu huỷ. */
@Component({
  selector: 'app-review-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    TextareaModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>{{ data.mode === 'approve' ? 'Duyệt nhật ký' : 'Trả lại nhật ký' }}</h2>
    <div dialogContent>
      <p class="subtitle">{{ data.title }}</p>
      <app-field class="field">
        <label fieldLabel>{{ data.mode === 'approve' ? 'Ý kiến (không bắt buộc)' : 'Lý do trả lại' }}</label>
        <textarea pTextarea [formControl]="note" rows="4" maxlength="1000"></textarea>
        @if (note.hasError('required')) {
          <app-error>Vui lòng nhập lý do để người lập biết cần sửa gì.</app-error>
        }
      </app-field>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" [severity]="data.mode === 'reject' ? 'danger' : undefined\" (click)="confirm()">
        {{ data.mode === 'approve' ? 'Phê duyệt' : 'Trả lại' }}
      </button>
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
export class ReviewDialogComponent {
  protected readonly data = injectDialogData<ReviewDialogData>();
  private readonly dialogRef = injectDialogRef<string>();

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
