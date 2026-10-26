import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { PhotoPickerComponent } from '../../../../shared/ui/photo-picker/photo-picker.component';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';

export interface ResolveResult {
  readonly note: string;
  readonly files: File[];
}

/** Báo đã khắc phục: bắt buộc ảnh sau khi xử lý để quản lý đối chiếu trước/sau. */
@Component({
  selector: 'app-resolve-dialog',
  imports: [
    ReactiveFormsModule,
    PhotoPickerComponent,
    ButtonModule,
    ...FIELD,
    TextareaModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Báo đã khắc phục</h2>
    <div dialogContent>
      <p class="subtitle">{{ title }}</p>
      <app-field class="field">
        <label fieldLabel>Nội dung đã xử lý</label>
        <textarea pTextarea [formControl]="note" rows="3" maxlength="1000"></textarea>
        @if (note.hasError('required') || note.hasError('pattern')) {
          <app-error>Vui lòng mô tả cách đã khắc phục.</app-error>
        }
      </app-field>
      <h3 class="label">Ảnh sau khắc phục (bắt buộc)</h3>
      <app-photo-picker [max]="10" (filesChange)="onFiles($event)" />
      @if (photoError()) {
        <p class="error" role="alert">Cần ít nhất 1 ảnh sau khi khắc phục.</p>
      }
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="button" (click)="confirm()">Gửi xác nhận</button>
    </div>
  `,
  styles: `
    .subtitle {
      margin: 0 0 12px;
      font-weight: 500;
    }
    .field {
      width: 100%;
    }
    .label {
      margin: 0 0 8px;
      font: var(--app-title-small);
    }
    .error {
      margin: 8px 0 0;
      font: var(--app-body-small);
      color: var(--app-error);
    }
  `,
})
export class ResolveDialogComponent {
  protected readonly title = injectDialogData<string>();
  private readonly dialogRef = injectDialogRef<ResolveResult>();

  protected readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
  });
  protected readonly photoError = signal(false);
  private files: File[] = [];

  protected onFiles(files: File[]): void {
    this.files = files;
    this.photoError.set(false);
  }

  protected confirm(): void {
    const noPhotos = this.files.length === 0;
    this.photoError.set(noPhotos);
    if (this.note.invalid || noPhotos) {
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close({ note: this.note.value.trim(), files: this.files });
  }
}
