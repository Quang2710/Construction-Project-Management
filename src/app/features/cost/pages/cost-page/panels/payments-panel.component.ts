import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStatusChipComponent } from '../../../components/cost-status-chip/cost-status-chip.component';
import { CostStore } from '../../../data-access/cost.store';
import { CostDialogsService } from '../cost-dialogs.service';

@Component({
  selector: 'app-payments-panel',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    CostStatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.overduePayments().length) {
      <div class="alert" role="status">
        <mat-icon>schedule</mat-icon>
        <span>{{ store.overduePayments().length }} đợt đã đề nghị thanh toán nhưng quá hạn chưa thu tiền.</span>
      </div>
    }

    @if (store.paymentsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.paymentsError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadPayments()" />
    } @else if (!store.paymentsLoading() && store.payments().length === 0) {
      <app-empty-state icon="payments" title="Chưa có kế hoạch thanh toán" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Đợt</th>
              <th class="num">Giá trị</th>
              <th class="hide-sm">Hạn</th>
              <th>Trạng thái</th>
              <th class="num">Đã thu</th>
              @if (store.canManage()) {
                <th class="actions"><span class="cdk-visually-hidden">Thao tác</span></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (payment of store.payments(); track payment.id) {
              <tr [class.row--warn]="payment.isOverdue">
                <td>
                  <div class="name">Đợt {{ payment.order }} · {{ payment.name }}</div>
                  <div class="sub">
                    {{ payment.percent }}% HĐ
                    @if (payment.invoicedAt) {
                      · đề nghị {{ payment.invoicedAt | date: 'dd/MM/yyyy' }}
                    }
                    @if (payment.paidAt) {
                      · thu {{ payment.paidAt | date: 'dd/MM/yyyy' }}
                    }
                  </div>
                </td>
                <td class="num">{{ payment.amount | vnd: 'compact' }}</td>
                <td class="hide-sm">{{ payment.dueDate | date: 'dd/MM/yyyy' }}</td>
                <td><app-cost-status-chip [status]="payment.status" [overdue]="payment.isOverdue" /></td>
                <td class="num">{{ payment.paidAmount ? (payment.paidAmount | vnd: 'compact') : '—' }}</td>
                @if (store.canManage()) {
                  <td class="actions">
                    @switch (payment.status) {
                      @case ('PLANNED') {
                        <button mat-stroked-button type="button" [disabled]="store.busy()" (click)="dialogs.invoice(payment)">
                          Đề nghị TT
                        </button>
                      }
                      @case ('INVOICED') {
                        <button mat-flat-button type="button" [disabled]="store.busy()" (click)="dialogs.receive(payment)">
                          Ghi nhận thu
                        </button>
                      }
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td>Tổng cộng ({{ totals().paidPercent }}% đã thu)</td>
              <td class="num">{{ totals().amount | vnd: 'compact' }}</td>
              <td class="hide-sm"></td>
              <td></td>
              <td class="num">{{ totals().paid | vnd: 'compact' }}</td>
              @if (store.canManage()) {
                <td></td>
              }
            </tr>
          </tfoot>
        </table>
      </div>
    }
  `,
  styleUrl: './panels.scss',
})
export class PaymentsPanelComponent {
  protected readonly store = inject(CostStore);
  protected readonly dialogs = inject(CostDialogsService);

  protected readonly totals = computed(() => {
    const payments = this.store.payments();
    const amount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const paid = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
    return { amount, paid, paidPercent: amount > 0 ? Math.round((paid / amount) * 100) : 0 };
  });
}
