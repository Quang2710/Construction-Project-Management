import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { MaterialRequestAction } from '../../data-access/materials-api.service';
import { MaterialRequest } from '../../models/material.model';
import { RequestStatusChipComponent } from '../request-status-chip/request-status-chip.component';
import { injectDialogData, injectDialogRef, DialogCloseDirective } from '../../../../shared/ui/dialog/app-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

export interface RequestDetailDialogData {
  readonly request: MaterialRequest;
  readonly canApprove: boolean;
  readonly canHandle: boolean;
}

export interface RequestDetailResult {
  readonly action: MaterialRequestAction;
  readonly note: string;
}

const HISTORY_LABELS: Readonly<Record<string, string>> = {
  CREATED: 'Lập phiếu',
  APPROVED: 'Duyệt',
  REJECTED: 'Từ chối',
  RECEIVED: 'Nhập kho',
};

@Component({
  selector: 'app-request-detail-dialog',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    VndPipe,
    RequestStatusChipComponent,
    ButtonModule,
    IconComponent,
    ...FIELD,
    TextareaModule,
    DialogCloseDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 dialogTitle class="title">
      Phiếu {{ request.code }} <app-request-status-chip [status]="request.status" />
    </h2>
    <div dialogContent>
      <p class="meta">
        {{ request.projectCode }} · Lập bởi {{ request.createdBy.fullName }} lúc {{ request.createdAt | date: 'HH:mm dd/MM/yyyy' }}
        · Cần trước {{ request.neededBy | date: 'dd/MM/yyyy' }}
      </p>
      @if (request.note) {
        <p class="note">“{{ request.note }}”</p>
      }

      <table class="table">
        <thead>
          <tr><th>Vật tư</th><th class="num">Số lượng</th><th class="num">Thành tiền</th></tr>
        </thead>
        <tbody>
          @for (item of request.items; track item.material.id) {
            <tr>
              <td>{{ item.material.code }} · {{ item.material.name }}</td>
              <td class="num">{{ item.quantity | number: '1.0-2' }} {{ item.material.unit }}</td>
              <td class="num">{{ item.quantity * item.unitPrice | vnd }}</td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr><td colspan="2">Tổng giá trị</td><td class="num">{{ request.totalValue | vnd }}</td></tr>
        </tfoot>
      </table>

      <h3 class="subtitle">Lịch sử</h3>
      <ul class="history">
        @for (entry of request.history; track $index) {
          <li>
            <strong>{{ historyLabel(entry.action) }}</strong> · {{ entry.by.fullName }} · {{ entry.at | date: 'HH:mm dd/MM/yyyy' }}
            @if (entry.note) {
              <span class="history__note">— {{ entry.note }}</span>
            }
          </li>
        }
      </ul>

      @if (showReject()) {
        <app-field class="full">
          <label fieldLabel>Lý do từ chối</label>
          <textarea pTextarea rows="2" [formControl]="note"></textarea>
          @if (note.invalid) {
            <app-error>Vui lòng nhập lý do từ chối.</app-error>
          }
        </app-field>
      }
    </div>
    <div dialogActions>
      <button pButton text type="button" appDialogClose>Đóng</button>
      @if (request.status === 'PENDING' && data.canApprove) {
        @if (showReject()) {
          <button pButton type="button" severity="danger" (click)="reject()">Xác nhận từ chối</button>
        } @else {
          <button pButton outlined severity="danger" type="button" (click)="showReject.set(true)">
            <app-icon>block</app-icon> Từ chối
          </button>
          <button pButton type="button" (click)="close('approve')"><app-icon>check</app-icon> Duyệt</button>
        }
      }
      @if (request.status === 'APPROVED' && data.canHandle) {
        <button pButton type="button" (click)="close('receive')"><app-icon>inventory</app-icon> Xác nhận nhập kho</button>
      }
    </div>
  `,
  styles: `
    .title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .meta,
    .note {
      margin: 0 0 8px;
      color: var(--app-on-surface-variant);
    }
    .table {
      width: 100%;
      margin: 8px 0 16px;
      border-collapse: collapse;
      th,
      td {
        padding: 6px 8px;
        border-bottom: 1px solid var(--app-outline-variant);
        text-align: left;
      }
      tfoot td {
        font-weight: 600;
      }
      .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }
    .subtitle {
      margin: 0 0 4px;
      font: var(--app-title-small);
    }
    .history {
      margin: 0 0 12px;
      padding-left: 18px;
      font: var(--app-body-small);
    }
    .history__note {
      color: var(--app-on-surface-variant);
    }
    .full {
      width: 100%;
    }
    .danger-text {
      color: var(--app-error);
    }
  `,
})
export class RequestDetailDialogComponent {
  protected readonly data = injectDialogData<RequestDetailDialogData>();
  private readonly dialogRef = injectDialogRef<RequestDetailResult>();
  protected readonly request = this.data.request;
  protected readonly showReject = signal(false);
  protected readonly note = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected historyLabel(action: string): string {
    return HISTORY_LABELS[action] ?? action;
  }

  protected close(action: MaterialRequestAction): void {
    this.dialogRef.close({ action, note: '' });
  }

  protected reject(): void {
    if (!this.note.value.trim()) {
      this.note.setErrors({ required: true });
      this.note.markAsTouched();
      return;
    }
    this.dialogRef.close({ action: 'reject', note: this.note.value.trim() });
  }
}
