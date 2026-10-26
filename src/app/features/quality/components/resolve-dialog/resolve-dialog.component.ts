import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PhotoPickerComponent } from '../../../../shared/ui/photo-picker/photo-picker.component';

export interface ResolveResult {
  readonly note: string;
  readonly files: File[];
}

/** Báo đã khắc phục: bắt buộc ảnh sau khi xử lý để quản lý đối chiếu trước/sau. */
@Component({
  selector: 'app-resolve-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, PhotoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Báo đã khắc phục</h2>
    <mat-dialog-content>
      <p class="subtitle">{{ title }}</p>
      <mat-form-field class="field">
        <mat-label>Nội dung đã xử lý</mat-label>
        <textarea matInput [formControl]="note" rows="3" maxlength="1000" cdkFocusInitial></textarea>
        @if (note.hasError('required') || note.hasError('pattern')) {
          <mat-error>Vui lòng mô tả cách đã khắc phục.</mat-error>
        }
      </mat-form-field>
      <h3 class="label">Ảnh sau khắc phục (bắt buộc)</h3>
      <app-photo-picker [max]="10" (filesChange)="onFiles($event)" />
      @if (photoError()) {
        <p class="error" role="alert">Cần ít nhất 1 ảnh sau khi khắc phục.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="button" (click)="confirm()">Gửi xác nhận</button>
    </mat-dialog-actions>
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
      font: var(--mat-sys-title-small);
    }
    .error {
      margin: 8px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
  `,
})
export class ResolveDialogComponent {
  protected readonly title = inject<string>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ResolveDialogComponent, ResolveResult>>(MatDialogRef);

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
