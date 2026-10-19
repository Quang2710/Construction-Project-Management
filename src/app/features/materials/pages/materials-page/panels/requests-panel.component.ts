import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { RequestStatusChipComponent } from '../../../components/request-status-chip/request-status-chip.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import {
  MATERIAL_REQUEST_STATUS_LABELS,
  MATERIAL_REQUEST_STATUSES,
  MaterialRequest,
  MaterialRequestStatus,
} from '../../../models/material.model';
import { MaterialsDialogsService } from '../materials-dialogs.service';

const ALL = 'ALL';

@Component({
  selector: 'app-requests-panel',
  imports: [
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    RequestStatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-chip-listbox
        aria-label="Lọc theo trạng thái"
        [value]="store.requestsStatus() ?? allValue"
        [hideSingleSelectionIndicator]="true"
        (change)="onStatus($event)"
      >
        <mat-chip-option [value]="allValue">Tất cả</mat-chip-option>
        @for (status of statuses; track status) {
          <mat-chip-option [value]="status">{{ statusLabels[status] }}</mat-chip-option>
        }
      </mat-chip-listbox>
      <span class="toolbar__spacer"></span>
      @if (store.canHandle()) {
        <button mat-flat-button type="button" (click)="create()"><mat-icon>add</mat-icon> Lập phiếu yêu cầu</button>
      }
    </div>

    @if (store.requestsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.requestsError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadRequests()" />
    } @else if (!store.requestsLoading() && store.requests().length === 0) {
      <app-empty-state icon="request_quote" title="Chưa có phiếu yêu cầu" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Phiếu</th>
              <th class="hide-sm">Người lập</th>
              <th class="hide-sm">Cần trước</th>
              <th class="num">Giá trị</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            @for (request of store.requests(); track request.id) {
              <tr class="row--clickable" tabindex="0" (click)="open(request)" (keydown.enter)="open(request)">
                <td>
                  <div class="name">{{ request.code }}</div>
                  <div class="sub">{{ request.items.length }} vật tư · {{ request.createdAt | date: 'dd/MM/yyyy' }}</div>
                </td>
                <td class="hide-sm">{{ request.createdBy.fullName }}</td>
                <td class="hide-sm">{{ request.neededBy | date: 'dd/MM/yyyy' }}</td>
                <td class="num">{{ request.totalValue | vnd: 'compact' }}</td>
                <td><app-request-status-chip [status]="request.status" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <mat-paginator
        [length]="store.requestsTotal()"
        [pageIndex]="store.requestsPage() - 1"
        [pageSize]="store.pageSize()"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
    }
  `,
  styleUrl: './panels.scss',
})
export class RequestsPanelComponent implements OnInit {
  private readonly dialogs = inject(MaterialsDialogsService);
  protected readonly store = inject(MaterialsStore);
  protected readonly allValue = ALL;
  protected readonly statuses = MATERIAL_REQUEST_STATUSES;
  protected readonly statusLabels = MATERIAL_REQUEST_STATUS_LABELS;

  ngOnInit(): void {
    void this.store.loadRequests();
  }

  protected onStatus(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    void this.store.setRequestsFilter(typeof value === 'string' && value !== ALL ? (value as MaterialRequestStatus) : null);
  }

  protected onPage(event: PageEvent): void {
    void this.store.setRequestsFilter(this.store.requestsStatus(), event.pageIndex + 1);
  }

  protected create(): void {
    void this.dialogs.openRequestForm();
  }

  protected open(request: MaterialRequest): void {
    void this.dialogs.openRequestDetail(request);
  }
}
