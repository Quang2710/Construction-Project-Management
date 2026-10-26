import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DrawingDraft } from '../../data-access/documents.store';
import { Discipline, DISCIPLINE_LABELS, DISCIPLINE_PREFIXES, DISCIPLINES } from '../../models/document.model';

const MAX_SIZE = 20 * 1024 * 1024;

export type DrawingUploadDialogData =
  | { readonly mode: 'drawing'; readonly projectCode: string }
  | { readonly mode: 'revision'; readonly drawingCode: string; readonly nextRevision: string };

export interface DrawingUploadResult {
  /** Chỉ có khi tạo bản vẽ mới. */
  readonly draft: DrawingDraft | null;
  readonly description: string;
  readonly file: File;
}

/** Tải lên bản vẽ mới (Rev A) hoặc phiên bản mới của bản vẽ đã có. Chỉ nhận PDF ≤ 20 MB. */
@Component({
  selector: 'app-drawing-upload-dialog',
  imports: [DecimalPipe, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'drawing') {
        Phát hành bản vẽ mới · {{ data.projectCode }}
      } @else {
        Phiên bản {{ data.nextRevision }} · {{ data.drawingCode }}
      }
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="drawing-upload-form" class="form" (ngSubmit)="save()">
        @if (data.mode === 'drawing') {
          <mat-form-field>
            <mat-label>Bộ môn</mat-label>
            <mat-select formControlName="discipline">
              @for (discipline of disciplines; track discipline) {
                <mat-option [value]="discipline">{{ disciplineLabels[discipline] }} ({{ prefixes[discipline] }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Số hiệu bản vẽ</mat-label>
            <input matInput formControlName="code" maxlength="20" [placeholder]="prefixes[form.controls.discipline.value] + '-101'" />
            @if (form.controls.code.hasError('required')) {
              <mat-error>Vui lòng nhập số hiệu bản vẽ.</mat-error>
            } @else if (form.controls.code.hasError('pattern')) {
              <mat-error>2–20 ký tự: chữ, số, dấu - . _</mat-error>
            }
          </mat-form-field>
          <mat-form-field class="full">
            <mat-label>Tên bản vẽ</mat-label>
            <input matInput formControlName="title" maxlength="200" />
            @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
              <mat-error>Vui lòng nhập tên bản vẽ.</mat-error>
            }
          </mat-form-field>
        }
        <mat-form-field class="full">
          <mat-label>{{ data.mode === 'drawing' ? 'Ghi chú phát hành' : 'Nội dung thay đổi so với phiên bản trước' }}</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
          @if (form.controls.description.hasError('required') || form.controls.description.hasError('pattern')) {
            <mat-error>Vui lòng mô tả nội dung thay đổi.</mat-error>
          }
        </mat-form-field>
      </form>

      <div class="file">
        <button mat-stroked-button type="button" (click)="picker.click()"><mat-icon>upload_file</mat-icon> Chọn tệp PDF</button>
        <input #picker hidden type="file" accept="application/pdf,.pdf" (change)="onFile(picker)" />
        @if (file(); as file) {
          <span class="file__name"><mat-icon>picture_as_pdf</mat-icon> {{ file.name }} · {{ file.size / 1048576 | number: '1.0-1' }} MB</span>
        }
      </div>
      @if (fileError()) {
        <p class="error" role="alert">{{ fileError() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="drawing-upload-form">Phát hành</button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      padding-top: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
    .file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .file__name {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      overflow-wrap: anywhere;
      font: var(--mat-sys-body-medium);
    }
    .error {
      margin: 8px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class DrawingUploadDialogComponent {
  protected readonly data = inject<DrawingUploadDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DrawingUploadDialogComponent, DrawingUploadResult>>(MatDialogRef);

  protected readonly disciplines = DISCIPLINES;
  protected readonly disciplineLabels = DISCIPLINE_LABELS;
  protected readonly prefixes = DISCIPLINE_PREFIXES;
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  private readonly isDrawing = this.data.mode === 'drawing';

  protected readonly form = new FormGroup({
    discipline: new FormControl<Discipline>('ARCH', { nonNullable: true }),
    code: new FormControl('', {
      nonNullable: true,
      validators: this.isDrawing ? [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9.\-_]{1,19}$/)] : [],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: this.isDrawing ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)] : [],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: this.isDrawing ? [Validators.maxLength(500)] : [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
    }),
  });

  protected onFile(element: HTMLInputElement): void {
    const file = element.files?.[0] ?? null;
    element.value = '';
    if (!file) {
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError.set('Chỉ chấp nhận tệp PDF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      this.fileError.set('Tệp vượt quá 20 MB.');
      return;
    }
    this.fileError.set(null);
    this.file.set(file);
  }

  protected save(): void {
    const file = this.file();
    if (!file) {
      this.fileError.set('Vui lòng chọn tệp PDF bản vẽ.');
    }
    if (this.form.invalid || !file) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const description = value.description.trim();
    // Kho file kiểm tra đúng MIME: một số máy gửi PDF với type rỗng.
    const pdf = file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf' });
    this.dialogRef.close({
      draft: this.isDrawing
        ? { code: value.code.trim().toUpperCase(), title: value.title.trim(), discipline: value.discipline, description }
        : null,
      description,
      file: pdf,
    });
  }
}
