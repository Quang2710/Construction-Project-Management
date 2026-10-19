import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { MaterialRequestAction } from '../../data-access/materials-api.service';
import { MaterialRequest } from '../../models/material.model';
import { RequestStatusChipComponent } from '../request-status-chip/request-status-chip.component';

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
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    VndPipe,
    RequestStatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="title">
      Phiếu {{ request.code }} <app-request-status-chip [status]="request.status" />
    </h2>
    <mat-dialog-content>
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
        <mat-form-field class="full">
          <mat-label>Lý do từ chối</mat-label>
          <textarea matInput rows="2" [formControl]="note" cdkFocusInitial></textarea>
          @if (note.invalid) {
            <mat-error>Vui lòng nhập lý do từ chối.</mat-error>
          }
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Đóng</button>
      @if (request.status === 'PENDING' && data.canApprove) {
        @if (showReject()) {
          <button mat-flat-button type="button" class="danger" (click)="reject()">Xác nhận từ chối</button>
        } @else {
          <button mat-stroked-button type="button" class="danger-text" (click)="showReject.set(true)">
            <mat-icon>block</mat-icon> Từ chối
          </button>
          <button mat-flat-button type="button" (click)="close('approve')"><mat-icon>check</mat-icon> Duyệt</button>
        }
      }
      @if (request.status === 'APPROVED' && data.canHandle) {
        <button mat-flat-button type="button" (click)="close('receive')"><mat-icon>inventory</mat-icon> Xác nhận nhập kho</button>
      }
    </mat-dialog-actions>
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
      color: var(--mat-sys-on-surface-variant);
    }
    .table {
      width: 100%;
      margin: 8px 0 16px;
      border-collapse: collapse;
      th,
      td {
        padding: 6px 8px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
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
      font: var(--mat-sys-title-small);
    }
    .history {
      margin: 0 0 12px;
      padding-left: 18px;
      font: var(--mat-sys-body-small);
    }
    .history__note {
      color: var(--mat-sys-on-surface-variant);
    }
    .full {
      width: 100%;
    }
    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
    .danger-text {
      color: var(--mat-sys-error);
    }
  `,
})
export class RequestDetailDialogComponent {
  protected readonly data = inject<RequestDetailDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RequestDetailDialogComponent, RequestDetailResult>>(MatDialogRef);
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
