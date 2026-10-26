import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
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
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { ProgressBarModule } from 'primeng/progressbar';
import { FormsModule } from '@angular/forms';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { withAllOption } from '../../../../../shared/utils/options';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';

const ALL = 'ALL';

@Component({
  selector: 'app-requests-panel',
  imports: [
    FormsModule,
    DatePipe,
    SelectButtonModule,
    PaginatorModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    RequestStatusChipComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <p-selectbutton class="app-chips" [options]="statusFilterOptions" optionLabel="label" optionValue="value" [allowEmpty]="false" [ngModel]="store.requestsStatus() ?? allValue" (onChange)="onStatus($event)" [attr.aria-label]="'Lọc theo trạng thái'" />
      <span class="toolbar__spacer"></span>
      @if (store.canHandle()) {
        <button pButton type="button" (click)="create()"><app-icon>add</app-icon> Lập phiếu yêu cầu</button>
      }
    </div>

    @if (store.requestsLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
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
      <p-paginator [totalRecords]="store.requestsTotal()" [first]="(store.requestsPage() - 1) * store.pageSize()" [rows]="store.pageSize()" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
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
  protected readonly statusFilterOptions = withAllOption(this.statuses, this.statusLabels, 'Tất cả');

  ngOnInit(): void {
    void this.store.loadRequests();
  }

  protected onStatus(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    void this.store.setRequestsFilter(typeof value === 'string' && value !== ALL ? (value as MaterialRequestStatus) : null);
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setRequestsFilter(this.store.requestsStatus(), (event.page ?? 0) + 1);
  }

  protected create(): void {
    void this.dialogs.openRequestForm();
  }

  protected open(request: MaterialRequest): void {
    void this.dialogs.openRequestDetail(request);
  }
}
