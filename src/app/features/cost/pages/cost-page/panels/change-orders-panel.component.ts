import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStatusChipComponent } from '../../../components/cost-status-chip/cost-status-chip.component';
import { CostStore } from '../../../data-access/cost.store';
import { CostDialogsService } from '../cost-dialogs.service';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-change-orders-panel',
  imports: [
    DatePipe,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    CostStatusChipComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
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
        <button pButton type="button" [disabled]="!store.costItems().length" (click)="dialogs.proposeChangeOrder()">
          <app-icon>add</app-icon> Đề xuất phát sinh
        </button>
      }
    </div>

    @if (store.changeOrdersLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
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
                        pButton text rounded severity="secondary"
                        type="button"
                        pTooltip="Chấp thuận" tooltipPosition="bottom"
                        aria-label="Chấp thuận"
                        [disabled]="store.busy()"
                        (click)="dialogs.decide(order, 'approve')"
                      >
                        <app-icon pButtonIcon>check</app-icon>
                      </button>
                      <button
                        pButton text rounded severity="secondary"
                        type="button"
                        pTooltip="Không chấp thuận" tooltipPosition="bottom"
                        aria-label="Không chấp thuận"
                        [disabled]="store.busy()"
                        (click)="dialogs.decide(order, 'reject')"
                      >
                        <app-icon pButtonIcon>close</app-icon>
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
