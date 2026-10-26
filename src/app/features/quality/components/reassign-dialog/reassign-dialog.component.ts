import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ROLE_LABELS, UserSummary } from '../../../../shared/models/user.model';
import { parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';

export interface ReassignDialogData {
  readonly members: readonly UserSummary[];
  readonly assigneeId: string | null;
  /** yyyy-MM-dd */
  readonly dueDate: string;
}

export interface ReassignResult {
  readonly assigneeId: string;
  readonly dueDate: string;
}

@Component({
  selector: 'app-reassign-dialog',
  imports: [
    RoleLabelPipe,
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
    <h2 dialogTitle>Giao lại / đổi hạn</h2>
    <div dialogContent>
      <form [formGroup]="form" id="reassign-form" class="form" (ngSubmit)="save()">
        <app-field>
          <label fieldLabel>Người xử lý</label>
          <p-select formControlName="assigneeId" [options]="data.members | mutable" optionValue="id" placeholder="Chọn…" [fluid]="true">
            <ng-template #selectedItem let-member>{{ member.fullName }} · {{ member.role | roleLabel }}</ng-template>
            <ng-template #item let-member>{{ member.fullName }} · {{ member.role | roleLabel }}</ng-template>
          </p-select>
          @if (form.controls.assigneeId.hasError('required')) {
            <app-error>Vui lòng chọn người xử lý.</app-error>
          }
        </app-field>
        <app-field>
          <label fieldLabel>Hạn xử lý</label>
          <p-datepicker formControlName="dueDate" dateFormat="dd/mm/yy" placeholder="dd/mm/yyyy" [showIcon]="true" iconDisplay="input" [showButtonBar]="true" [fluid]="true" />
          @if (form.controls.dueDate.hasError('required')) {
            <app-error>Vui lòng chọn hạn xử lý.</app-error>
          }
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="reassign-form">Lưu</button>
    </div>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(380px, 100%);
      padding-top: 4px;
    }
  `,
})
export class ReassignDialogComponent {
  protected readonly data = injectDialogData<ReassignDialogData>();
  private readonly dialogRef = injectDialogRef<ReassignResult>();
  protected readonly roleLabels = ROLE_LABELS;

  protected readonly form = new FormGroup({
    assigneeId: new FormControl(this.data.assigneeId ?? '', { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl<Date | null>(parseIsoDate(this.data.dueDate), [Validators.required]),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.dueDate) {
      this.dialogRef.close({ assigneeId: value.assigneeId, dueDate: toIsoDate(value.dueDate) });
    }
  }
}
