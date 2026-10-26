import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { addDays } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ROLE_LABELS, UserSummary } from '../../../../shared/models/user.model';
import { PhotoPickerComponent } from '../../../../shared/ui/photo-picker/photo-picker.component';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { PunchDraft } from '../../data-access/quality.store';
import { PUNCH_SEVERITIES, PUNCH_SEVERITY_LABELS, PunchSeverity } from '../../models/quality.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { toOptions } from '../../../../shared/utils/options';
import { minDateValidator } from '../../../../shared/utils/date-validators';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';

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
    RoleLabelPipe,
    MutablePipe,
    ReactiveFormsModule,
    PhotoPickerComponent,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    TextareaModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Ghi nhận lỗi · {{ data.projectCode }}</h2>
    <div dialogContent>
      @if (data.prefill) {
        <p class="origin">Từ phiếu {{ data.prefill.inspectionCode }} – tiêu chí không đạt</p>
      }
      <form [formGroup]="form" id="punch-form" class="form" (ngSubmit)="save()">
        <app-field class="full">
          <label fieldLabel>Lỗi cần xử lý</label>
          <input pInputText formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <app-error>Vui lòng mô tả ngắn lỗi cần xử lý.</app-error>
          }
        </app-field>

        <app-field class="full">
          <label fieldLabel>Mô tả chi tiết</label>
          <textarea pTextarea formControlName="description" rows="2" maxlength="2000"></textarea>
        </app-field>

        <app-field>
          <label fieldLabel>Vị trí</label>
          <input pInputText formControlName="location" maxlength="200" />
        </app-field>

        <app-field>
          <label fieldLabel>Mức độ</label>
          <p-select formControlName="severity" [options]="severityOptions" optionLabel="label" optionValue="value" placeholder="Chọn…" [fluid]="true" />
        </app-field>

        <app-field>
          <label fieldLabel>Người xử lý</label>
          <p-select formControlName="assigneeId" [options]="data.members | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-member>{{ member.fullName }} · {{ member.role | roleLabel }}</ng-template>
            <ng-template #item let-member>{{ member.fullName }} · {{ member.role | roleLabel }}</ng-template>
          </p-select>
          @if (form.controls.assigneeId.hasError('required')) {
            <app-error>Vui lòng giao người xử lý.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Hạn xử lý</label>
          <p-datepicker [minDate]="today" formControlName="dueDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [fluid]="true" />
          @if (form.controls.dueDate.hasError('required')) {
            <app-error>Vui lòng chọn hạn xử lý.</app-error>
          } @else if (form.controls.dueDate.hasError('minDate')) {
            <app-error>Hạn xử lý không được ở quá khứ.</app-error>
          }
        </app-field>
      </form>

      <h3 class="subtitle">Ảnh hiện trạng (bắt buộc)</h3>
      <app-photo-picker [max]="10" (filesChange)="onFiles($event)" />
      @if (photoError()) {
        <p class="error" role="alert">Cần ít nhất 1 ảnh hiện trạng lỗi.</p>
      }
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="punch-form">Ghi nhận & giao việc</button>
    </div>
  `,
  styles: `
    .origin {
      margin: 0 0 12px;
      font: var(--app-body-small);
      color: var(--app-on-surface-variant);
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
      font: var(--app-title-small);
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
export class PunchFormDialogComponent {
  protected readonly data = injectDialogData<PunchFormDialogData>();
  private readonly dialogRef = injectDialogRef<PunchFormResult>();

  protected readonly severities = PUNCH_SEVERITIES;
  protected readonly severityLabels = PUNCH_SEVERITY_LABELS;
  protected readonly severityOptions = toOptions(this.severities, this.severityLabels);
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
    dueDate: new FormControl<Date | null>(addDays(new Date(), DEFAULT_DUE_DAYS), [Validators.required, minDateValidator(this.today)]),
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
