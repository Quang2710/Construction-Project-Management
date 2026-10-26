import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { WbsCreateRequest, WbsNode } from '../../models/wbs.model';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { MutablePipe } from '../../../../shared/pipes/mutable.pipe';

export interface WbsDialogData {
  readonly nodes: readonly WbsNode[];
}

@Component({
  selector: 'app-wbs-dialog',
  imports: [
    MutablePipe,
    ReactiveFormsModule,
    ButtonModule,
    ...FIELD,
    InputTextModule,
    DialogCloseDirective,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle>Thêm hạng mục WBS</h2>
    <div dialogContent>
      <form [formGroup]="form" id="wbs-form" (ngSubmit)="save()" class="form">
        <app-field>
          <label fieldLabel>Tên hạng mục</label>
          <input pInputText formControlName="name" maxlength="200" />
          @if (form.controls.name.hasError('required')) {
            <app-error>Vui lòng nhập tên hạng mục.</app-error>
          }
        </app-field>
        <app-field>
          <label fieldLabel>Thuộc hạng mục</label>
          <p-select formControlName="parentId" [options]="data.nodes | mutable" optionValue="id" [showClear]="true" placeholder="— Cấp cao nhất —" [fluid]="true">
            <ng-template #selectedItem let-node>{{ node.code }}. {{ node.name }}</ng-template>
            <ng-template #item let-node>{{ node.code }}. {{ node.name }}</ng-template>
          </p-select>
        </app-field>
      </form>
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Huỷ</button>
      <button pButton type="submit" form="wbs-form">Thêm</button>
    </div>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      min-width: min(380px, 100%);
      padding-top: 4px;
    }
  `,
})
export class WbsDialogComponent {
  protected readonly data = injectDialogData<WbsDialogData>();
  private readonly dialogRef = injectDialogRef<WbsCreateRequest>();

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    parentId: new FormControl<string | null>(null),
  });

  protected save(): void {
    if (this.form.invalid || !this.form.controls.name.value.trim()) {
      this.form.controls.name.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }
    const { name, parentId } = this.form.getRawValue();
    this.dialogRef.close({ name: name.trim(), parentId });
  }
}
