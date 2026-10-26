import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStatusChipComponent } from '../../../components/cost-status-chip/cost-status-chip.component';
import { CostStore } from '../../../data-access/cost.store';
import { CostDialogsService } from '../cost-dialogs.service';

@Component({
  selector: 'app-change-orders-panel',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    CostStatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <span class="toolbar__summary">
        Đã chấp thuận: chi phí +{{ totals().approvedCost | vnd: 'compact' }} · hợp đồng +{{ totals().approvedRevenue | vnd: 'compact' }}
        @if (store.pendingChangeOrders().length) {
          · <strong>{{ store.pendingChangeOrders().length }} chờ quyết định</strong>
        }
      </span>
      <span class="toolbar__spacer"></span>
      @if (store.canManage()) {
        <button mat-flat-button type="button" [disabled]="!store.costItems().length" (click)="dialogs.proposeChangeOrder()">
          <mat-icon>add</mat-icon> Đề xuất phát sinh
        </button>
      }
    </div>

    @if (store.changeOrdersLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.changeOrdersError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadChangeOrders()" />
    } @else if (!store.changeOrdersLoading() && store.changeOrders().length === 0) {
      <app-empty-state icon="difference" title="Chưa có chi phí phát sinh" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Phát sinh</th>
              <th class="hide-sm">Hạng mục</th>
              <th class="num">Chi phí thêm</th>
              <th class="num">Giá trị thanh toán</th>
              <th>Trạng thái</th>
              @if (store.canManage()) {
                <th class="actions"><span class="cdk-visually-hidden">Thao tác</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (order of store.changeOrders(); track order.id) {
              <tr>
                <td>
                  <div class="name">{{ order.code }} · {{ order.title }}</div>
                  <div class="sub">
                    {{ order.date | date: 'dd/MM/yyyy' }} · {{ order.createdBy.fullName }}
                    @if (order.decisionNote) {
                      · “{{ order.decisionNote }}”
                    }
                  </div>
                </td>
                <td class="hide-sm">{{ order.costItemName }}</td>
                <td class="num">{{ order.costAmount | vnd: 'compact' }}</td>
                <td class="num" [class.negative]="order.revenueAmount < order.costAmount">{{ order.revenueAmount | vnd: 'compact' }}</td>
                <td><app-cost-status-chip [status]="order.status" /></td>
                @if (store.canManage()) {
                  <td class="actions">
                    @if (order.status === 'PROPOSED') {
                      <button
                        mat-icon-button
                        type="button"
                        matTooltip="Chấp thuận"
                        aria-label="Chấp thuận"
                        [disabled]="store.busy()"
                        (click)="dialogs.decide(order, 'approve')"
                      >
                        <mat-icon>check</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        type="button"
                        matTooltip="Không chấp thuận"
                        aria-label="Không chấp thuận"
                        [disabled]="store.busy()"
                        (click)="dialogs.decide(order, 'reject')"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styleUrl: './panels.scss',
})
export class ChangeOrdersPanelComponent {
  protected readonly store = inject(CostStore);
  protected readonly dialogs = inject(CostDialogsService);

  protected readonly totals = computed(() => {
    const approved = this.store.changeOrders().filter((order) => order.status === 'APPROVED');
    return {
      approvedCost: approved.reduce((sum, order) => sum + order.costAmount, 0),
      approvedRevenue: approved.reduce((sum, order) => sum + order.revenueAmount, 0),
    };
  });
}
