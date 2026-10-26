import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { FormsModule } from '@angular/forms';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import { STOCK_TRANSACTION_LABELS, StockTransactionType } from '../../../models/material.model';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MutablePipe } from '../../../../../shared/pipes/mutable.pipe';

@Component({
  selector: 'app-transactions-panel',
  imports: [
    MutablePipe,
    FormsModule,
    DatePipe,
    DecimalPipe,
    SelectButtonModule,
    PaginatorModule,
    EmptyStateComponent,
    ErrorStateComponent,
    IconComponent,
    ProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <p-selectbutton class="app-chips"
        [options]="typeOptions | mutable"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ngModel]="store.transactionsType() ?? 'ALL'"
        (onChange)="onType($event)"
        [attr.aria-label]="'Loại phiếu'"
      />
    </div>

    @if (store.transactionsLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
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
                    <app-icon>{{ tx.type === 'IN' ? 'south' : 'north' }}</app-icon>{{ labels[tx.type] }}
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
      <p-paginator [totalRecords]="store.transactionsTotal()" [first]="(store.transactionsPage() - 1) * store.pageSize()" [rows]="store.pageSize()" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
    }
  `,
  styleUrl: './panels.scss',
})
export class TransactionsPanelComponent implements OnInit {
  protected readonly typeOptions = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Nhập kho', value: 'IN' },
    { label: 'Xuất kho', value: 'OUT' },
  ] as const;
  protected readonly store = inject(MaterialsStore);
  protected readonly labels = STOCK_TRANSACTION_LABELS;

  ngOnInit(): void {
    void this.store.loadTransactions();
  }

  protected onType(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    void this.store.setTransactionsFilter(value === 'IN' || value === 'OUT' ? (value as StockTransactionType) : null);
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setTransactionsFilter(this.store.transactionsType(), (event.page ?? 0) + 1);
  }
}
