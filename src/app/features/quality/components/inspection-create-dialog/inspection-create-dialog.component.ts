import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { merge } from 'rxjs';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { WbsNode } from '../../../scheduling/models/wbs.model';
import { ChecklistTemplate, InspectionCreateRequest } from '../../models/quality.model';

export interface InspectionCreateDialogData {
  readonly projectCode: string;
  readonly wbs: readonly WbsNode[];
  readonly templates: readonly ChecklistTemplate[];
}

export type InspectionCreateResult = Omit<InspectionCreateRequest, 'projectId'>;

/** Lập phiếu nghiệm thu mới: chọn hạng mục + mẫu checklist. */
@Component({
  selector: 'app-inspection-create-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Lập phiếu nghiệm thu · {{ data.projectCode }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="inspection-create-form" class="form" (ngSubmit)="save()">
        <mat-form-field class="full">
          <mat-label>Hạng mục (WBS)</mat-label>
          <mat-select formControlName="wbsId">
            @for (node of data.wbs; track node.id) {
              <mat-option [value]="node.id">{{ node.code }} · {{ node.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.wbsId.hasError('required')) {
            <mat-error>Vui lòng chọn hạng mục cần nghiệm thu.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Mẫu checklist</mat-label>
          <mat-select formControlName="templateId">
            @for (template of data.templates; track template.id) {
              <mat-option [value]="template.id">{{ template.name }} ({{ template.items.length }} tiêu chí)</mat-option>
            }
          </mat-select>
          @if (form.controls.templateId.hasError('required')) {
            <mat-error>Vui lòng chọn mẫu checklist.</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full">
          <mat-label>Tên phiếu</mat-label>
          <input matInput formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <mat-error>Vui lòng nhập tên phiếu nghiệm thu.</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Vị trí</mat-label>
          <input matInput formControlName="location" maxlength="200" placeholder="VD: Sàn tầng 5, trục A–C" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Ngày nghiệm thu</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="inspectionDate" placeholder="dd/MM/yyyy" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.inspectionDate.hasError('matDatepickerParse')) {
            <mat-error>Ngày không đúng định dạng dd/MM/yyyy.</mat-error>
          } @else if (form.controls.inspectionDate.hasError('required')) {
            <mat-error>Vui lòng chọn ngày nghiệm thu.</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Huỷ</button>
      <button mat-flat-button type="submit" form="inspection-create-form">Lập phiếu</button>
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
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class InspectionCreateDialogComponent {
  protected readonly data = inject<InspectionCreateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<InspectionCreateDialogComponent, InspectionCreateResult>>(MatDialogRef);

  protected readonly form = new FormGroup({
    wbsId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    templateId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    inspectionDate: new FormControl<Date | null>(new Date(), [Validators.required]),
  });

  constructor() {
    // Gợi ý tên phiếu "<mẫu> – <hạng mục>" cho tới khi người dùng tự sửa tên.
    merge(this.form.controls.wbsId.valueChanges, this.form.controls.templateId.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.form.controls.title.dirty) {
          return;
        }
        const template = this.data.templates.find((item) => item.id === this.form.controls.templateId.value);
        const node = this.data.wbs.find((item) => item.id === this.form.controls.wbsId.value);
        this.form.controls.title.setValue([template?.name, node?.name].filter(Boolean).join(' – '));
      });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (!value.inspectionDate) {
      return;
    }
    this.dialogRef.close({
      wbsId: value.wbsId,
      templateId: value.templateId,
      title: value.title.trim(),
      location: value.location.trim(),
      inspectionDate: toIsoDate(value.inspectionDate),
    });
  }
}
