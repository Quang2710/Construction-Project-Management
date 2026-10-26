import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DrawingDraft } from '../../data-access/documents.store';
import { Discipline, DISCIPLINE_LABELS, DISCIPLINE_PREFIXES, DISCIPLINES } from '../../models/document.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

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
  imports: [
    MutablePipe,
    DecimalPipe,
    ReactiveFormsModule,
    ButtonModule,
    IconComponent,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>
      @if (data.mode === 'drawing') {
        Phát hành bản vẽ mới · {{ data.projectCode }}
      } @else {
        Phiên bản {{ data.nextRevision }} · {{ data.drawingCode }}
      }
    </h2>
    <div dialogContent>
      <form [formGroup]="form" id="drawing-upload-form" class="form" (ngSubmit)="save()">
        @if (data.mode === 'drawing') {
          <app-field>
            <label fieldLabel>Bộ môn</label>
            <p-select formControlName="discipline" [options]="disciplines | mutable" placeholder="Chọn…" [fluid]="true">
              <ng-template #selectedItem let-discipline>{{ $any(disciplineLabels)[discipline] }} ({{ $any(prefixes)[discipline] }})</ng-template>
              <ng-template #item let-discipline>{{ $any(disciplineLabels)[discipline] }} ({{ $any(prefixes)[discipline] }})</ng-template>
            </p-select>
          </app-field>
          <app-field>
            <label fieldLabel>Số hiệu bản vẽ</label>
            <input pInputText formControlName="code" maxlength="20" [placeholder]="prefixes[form.controls.discipline.value] + '-101'" />
            @if (form.controls.code.hasError('required')) {
              <app-error>Vui lòng nhập số hiệu bản vẽ.</app-error>
            } @else if (form.controls.code.hasError('pattern')) {
              <app-error>2–20 ký tự: chữ, số, dấu - . _</app-error>
            }
          </app-field>
          <app-field class="full">
            <label fieldLabel>Tên bản vẽ</label>
            <input pInputText formControlName="title" maxlength="200" />
            @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
              <app-error>Vui lòng nhập tên bản vẽ.</app-error>
            }
          </app-field>
        }
        <app-field class="full">
          <label fieldLabel>{{ data.mode === 'drawing' ? 'Ghi chú phát hành' : 'Nội dung thay đổi so với phiên bản trước' }}</label>
          <textarea pTextarea formControlName="description" rows="2" maxlength="500"></textarea>
          @if (form.controls.description.hasError('required') || form.controls.description.hasError('pattern')) {
            <app-error>Vui lòng mô tả nội dung thay đổi.</app-error>
          }
        </app-field>
      </form>

      <div class="file">
        <button pButton outlined type="button" (click)="picker.click()"><app-icon>upload_file</app-icon> Chọn tệp PDF</button>
        <input #picker hidden type="file" accept="application/pdf,.pdf" (change)="onFile(picker)" />
        @if (file(); as file) {
          <span class="file__name"><app-icon>picture_as_pdf</app-icon> {{ file.name }} · {{ file.size / 1048576 | number: '1.0-1' }} MB</span>
        }
      </div>
      @if (fileError()) {
        <p class="error" role="alert">{{ fileError() }}</p>
      }
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="drawing-upload-form">Phát hành</button>
    </div>
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
      font: var(--app-body-medium);
    }
    .error {
      margin: 8px 0 0;
      font: var(--app-body-small);
      color: var(--app-error);
    }
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class DrawingUploadDialogComponent {
  protected readonly data = injectDialogData<DrawingUploadDialogData>();
  private readonly dialogRef = injectDialogRef<DrawingUploadResult>();

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
