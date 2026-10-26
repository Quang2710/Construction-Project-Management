import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { WbsNode } from '../../../scheduling/models/wbs.model';
import { ChecklistTemplate, InspectionCreateRequest } from '../../models/quality.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

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
    MutablePipe,
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
    SelectModule,
    DatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Lập phiếu nghiệm thu · {{ data.projectCode }}</h2>
    <div dialogContent>
      <form [formGroup]="form" id="inspection-create-form" class="form" (ngSubmit)="save()">
        <app-field class="full">
          <label fieldLabel>Hạng mục (WBS)</label>
          <p-select formControlName="wbsId" [options]="data.wbs | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-node>{{ node.code }} · {{ node.name }}</ng-template>
            <ng-template #item let-node>{{ node.code }} · {{ node.name }}</ng-template>
          </p-select>
          @if (form.controls.wbsId.hasError('required')) {
            <app-error>Vui lòng chọn hạng mục cần nghiệm thu.</app-error>
          }
        </app-field>

        <app-field class="full">
          <label fieldLabel>Mẫu checklist</label>
          <p-select formControlName="templateId" [options]="data.templates | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-template>{{ template.name }} ({{ template.items.length }} tiêu chí)</ng-template>
            <ng-template #item let-template>{{ template.name }} ({{ template.items.length }} tiêu chí)</ng-template>
          </p-select>
          @if (form.controls.templateId.hasError('required')) {
            <app-error>Vui lòng chọn mẫu checklist.</app-error>
          }
        </app-field>

        <app-field class="full">
          <label fieldLabel>Tên phiếu</label>
          <input pInputText formControlName="title" maxlength="200" />
          @if (form.controls.title.hasError('required') || form.controls.title.hasError('pattern')) {
            <app-error>Vui lòng nhập tên phiếu nghiệm thu.</app-error>
          }
        </app-field>

        <app-field>
          <label fieldLabel>Vị trí</label>
          <input pInputText formControlName="location" maxlength="200" placeholder="VD: Sàn tầng 5, trục A–C" />
        </app-field>

        <app-field>
          <label fieldLabel>Ngày nghiệm thu</label>
          <p-datepicker formControlName="inspectionDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [fluid]="true" />
          @if (form.controls.inspectionDate.hasError('required')) {
            <app-error>Vui lòng chọn ngày nghiệm thu.</app-error>
          }
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="inspection-create-form">Lập phiếu</button>
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
    @media (max-width: 599.98px) {
      .form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class InspectionCreateDialogComponent {
  protected readonly data = injectDialogData<InspectionCreateDialogData>();
  private readonly dialogRef = injectDialogRef<InspectionCreateResult>();

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
