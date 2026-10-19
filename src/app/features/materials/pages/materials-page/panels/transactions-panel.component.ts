import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import { STOCK_TRANSACTION_LABELS, StockTransactionType } from '../../../models/material.model';

@Component({
  selector: 'app-transactions-panel',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-button-toggle-group
        hideSingleSelectionIndicator
        aria-label="Loại phiếu"
        [value]="store.transactionsType() ?? 'ALL'"
        (change)="onType($event)"
      >
        <mat-button-toggle value="ALL">Tất cả</mat-button-toggle>
        <mat-button-toggle value="IN">Nhập kho</mat-button-toggle>
        <mat-button-toggle value="OUT">Xuất kho</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    @if (store.transactionsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.transactionsError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadTransactions()" />
    } @else if (!store.transactionsLoading() && store.transactions().length === 0) {
      <app-empty-state icon="receipt_long" title="Chưa có giao dịch kho" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Phiếu</th>
              <th>Vật tư</th>
              <th class="num">Số lượng</th>
              <th class="num hide-sm">Tồn sau</th>
              <th class="hide-sm">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            @for (tx of store.transactions(); track tx.id) {
              <tr>
                <td>
                  <span class="type" [class]="tx.type === 'IN' ? 'type--in' : 'type--out'">
                    <mat-icon>{{ tx.type === 'IN' ? 'south' : 'north' }}</mat-icon>{{ labels[tx.type] }}
                  </span>
                  <div class="sub">{{ tx.code }} · {{ tx.createdAt | date: 'HH:mm dd/MM/yyyy' }}</div>
                </td>
                <td>
                  <div class="name">{{ tx.material.name }}</div>
                  <div class="sub">{{ tx.createdBy.fullName }}</div>
                </td>
                <td class="num">{{ tx.type === 'IN' ? '+' : '−' }}{{ tx.quantity | number: '1.0-2' }} {{ tx.material.unit }}</td>
                <td class="num hide-sm">{{ tx.balanceAfter | number: '1.0-2' }}</td>
                <td class="hide-sm">{{ tx.note || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <mat-paginator
        [length]="store.transactionsTotal()"
        [pageIndex]="store.transactionsPage() - 1"
        [pageSize]="store.pageSize()"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
    }
  `,
  styleUrl: './panels.scss',
})
export class TransactionsPanelComponent implements OnInit {
  protected readonly store = inject(MaterialsStore);
  protected readonly labels = STOCK_TRANSACTION_LABELS;

  ngOnInit(): void {
    void this.store.loadTransactions();
  }

  protected onType(event: MatButtonToggleChange): void {
    const value: unknown = event.value;
    void this.store.setTransactionsFilter(value === 'IN' || value === 'OUT' ? (value as StockTransactionType) : null);
  }

  protected onPage(event: PageEvent): void {
    void this.store.setTransactionsFilter(this.store.transactionsType(), event.pageIndex + 1);
  }
}
