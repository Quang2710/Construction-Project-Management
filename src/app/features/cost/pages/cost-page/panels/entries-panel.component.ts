import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStore } from '../../../data-access/cost.store';
import { COST_CATEGORIES, COST_CATEGORY_LABELS, CostCategory } from '../../../models/cost.model';
import { CostDialogsService } from '../cost-dialogs.service';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../../shared/ui/field/field.component';
import { withAllOption } from '../../../../../shared/utils/options';

const ALL = 'ALL';

@Component({
  selector: 'app-entries-panel',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    SelectButtonModule,
    PaginatorModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
    ...FIELD,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <app-field class="toolbar__search" dense>
        <label fieldLabel>Tìm nội dung, nhà cung cấp, số chứng từ</label>
        <app-icon fieldPrefix>search</app-icon>
        <input pInputText [formControl]="search" />
      </app-field>
      <span class="toolbar__spacer"></span>
      @if (store.canManage()) {
        <button pButton type="button" [disabled]="!store.costItems().length" (click)="dialogs.addEntry()">
          <app-icon>add</app-icon> Ghi nhận chi phí
        </button>
      }
    </div>
    <div class="toolbar">
      <p-selectbutton class="app-chips" [options]="categoryFilterOptions" optionLabel="label" optionValue="value" [allowEmpty]="false" [ngModel]="store.entriesCategory() ?? allValue" (onChange)="onCategory($event)" [attr.aria-label]="'Lọc theo loại chi phí'" />
    </div>

    @if (store.entriesLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
    }
    @if (store.entriesError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadEntries()" />
    } @else if (!store.entriesLoading() && store.entries().length === 0) {
      <app-empty-state
        icon="receipt_long"
        title="Không có chứng từ chi phí"
        [message]="store.entriesQuery() || store.entriesCategory() ? 'Thử bỏ bớt bộ lọc.' : ''"
      />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nội dung</th>
              <th class="hide-sm">Hạng mục</th>
              <th class="hide-sm">Loại</th>
              <th class="num">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of store.entries(); track entry.id) {
              <tr>
                <td>{{ entry.date | date: 'dd/MM/yyyy' }}</td>
                <td>
                  <div class="name">{{ entry.description }}</div>
                  <div class="sub">
                    {{ entry.vendor || '—' }}
                    @if (entry.documentNo) {
                      · {{ entry.documentNo }}
                    }
                  </div>
                </td>
                <td class="hide-sm">{{ entry.costItemName }}</td>
                <td class="hide-sm">{{ categoryLabels[entry.category] }}</td>
                <td class="num">{{ entry.amount | vnd }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p-paginator [totalRecords]="store.entriesTotal()" [first]="(store.entriesPage() - 1) * store.pageSize()" [rows]="store.pageSize()" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
    }
  `,
  styleUrl: './panels.scss',
})
export class EntriesPanelComponent {
  protected readonly store = inject(CostStore);
  protected readonly dialogs = inject(CostDialogsService);
  protected readonly allValue = ALL;
  protected readonly categories = COST_CATEGORIES;
  protected readonly categoryLabels = COST_CATEGORY_LABELS;
  protected readonly categoryFilterOptions = withAllOption(this.categories, this.categoryLabels, 'Tất cả');
  protected readonly search = new FormControl(this.store.entriesQuery(), { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.store.setEntriesFilter({ q }));
  }

  protected onCategory(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    void this.store.setEntriesFilter({ category: typeof value === 'string' && value !== ALL ? (value as CostCategory) : null });
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setEntriesFilter({ page: (event.page ?? 0) + 1 });
  }
}
