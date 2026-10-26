import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { addDays } from 'date-fns';
import { ROLE_LABELS, UserSummary } from '../../../../shared/models/user.model';
import { PhotoPickerComponent } from '../../../../shared/ui/photo-picker/photo-picker.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { PunchDraft } from '../../data-access/quality.store';
import { PUNCH_SEVERITIES, PUNCH_SEVERITY_LABELS, PunchSeverity } from '../../models/quality.model';

export interface PunchFormDialogData {
  readonly projectCode: string;
  readonly members: readonly UserSummary[];
  /** Điền sẵn khi ghi nhận từ tiêu chí không đạt. */
  readonly prefill?: {
    readonly title: string;
    readonly description: string;
    readonly location: string;
    readonly checklistItemId: string;
    readonly inspectionCode: string;
  };
}

export interface PunchFormResult {
  readonly draft: PunchDraft;
  readonly files: File[];
}

const DEFAULT_DUE_DAYS = 7;

/** Ghi nhận lỗi cần xử lý: mô tả, mức độ, người xử lý, hạn và ảnh hiện trạng (bắt buộc). */
@Component({
  selector: 'app-punch-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PhotoPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Ghi nhận lỗi · {{ data.projectCode }}</h2>
    <mat-dialog-content>
      @if (data.prefill) {
        <p class="origin">Từ phiếu {{ data.prefill.inspectionCode }} – tiêu chí không đạt</p>
      }
      <form [formGroup]="form" id="punch-form" class="form" (ngSubmit)="save()">
        <mat-form-field class="full">
          <mat-label>Lỗi cần xử lý</mat-label>
          <input matInput formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <mat-error>Vui lòng mô tả ngắn lỗi cần xử lý.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Mô tả chi tiết</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="2000"></textarea>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Vị trí</mat-label>
          <input matInput formControlName="location" maxlength="200" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Mức độ</mat-label>
          <mat-select formControlName="severity">
            @for (severity of severities; track severity) {
              <mat-option [value]="severity">{{ severityLabels[severity] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Người xử lý</mat-label>
          <mat-select formControlName="assigneeId">
            @for (member of data.members; track member.id) {
              <mat-option [value]="member.id">{{ member.fullName }} · {{ roleLabels[member.role] }}</mat-option>
            }
          </mat-select>
          @if (form.controls.assigneeId.hasError('required')) {
            <mat-error>Vui lòng giao người xử lý.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Hạn xử lý</mat-label>
          <input matInput [matDatepicker]="picker" [min]="today" formControlName="dueDate" placeholder="dd/MM/yyyy" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.dueDate.hasError('matDatepickerParse')) {
            <mat-error>Ngày không đúng định dạng dd/MM/yyyy.</mat-error>
          } @else if (form.controls.dueDate.hasError('required')) {
            <mat-error>Vui lòng chọn hạn xử lý.</mat-error>
          } @else if (form.controls.dueDate.hasError('matDatepickerMin')) {
            <mat-error>Hạn xử lý không được ở quá khứ.</mat-error>
          }
        </mat-form-field>
      </form>

      <h3 class="subtitle">Ảnh hiện trạng (bắt buộc)</h3>
      <app-photo-picker [max]="10" (filesChange)="onFiles($event)" />
      @if (photoError()) {
        <p class="error" role="alert">Cần ít nhất 1 ảnh hiện trạng lỗi.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="punch-form">Ghi nhận & giao việc</button>
    </mat-dialog-actions>
  `,
  styles: `
    .origin {
      margin: 0 0 12px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      padding-top: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
    .subtitle {
      margin: 4px 0 8px;
      font: var(--mat-sys-title-small);
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
export class PunchFormDialogComponent {
  protected readonly data = inject<PunchFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PunchFormDialogComponent, PunchFormResult>>(MatDialogRef);

  protected readonly severities = PUNCH_SEVERITIES;
  protected readonly severityLabels = PUNCH_SEVERITY_LABELS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly today = new Date();
  protected readonly photoError = signal(false);
  private files: File[] = [];

  protected readonly form = new FormGroup({
    title: new FormControl(this.data.prefill?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    description: new FormControl(this.data.prefill?.description ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    location: new FormControl(this.data.prefill?.location ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    severity: new FormControl<PunchSeverity>('MEDIUM', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl<Date | null>(addDays(new Date(), DEFAULT_DUE_DAYS), [Validators.required]),
  });

  protected onFiles(files: File[]): void {
    this.files = files;
    this.photoError.set(false);
  }

  protected save(): void {
    const noPhotos = this.files.length === 0;
    this.photoError.set(noPhotos);
    if (this.form.invalid || noPhotos) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.dueDate) {
      return;
    }
    this.dialogRef.close({
      draft: {
        inspectionId: null,
        checklistItemId: this.data.prefill?.checklistItemId ?? null,
        title: value.title.trim(),
        description: value.description.trim(),
        location: value.location.trim(),
        severity: value.severity,
        assigneeId: value.assigneeId,
        dueDate: toIsoDate(value.dueDate),
      },
      files: this.files,
    });
  }
}
