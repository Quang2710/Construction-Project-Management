import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { CostStore } from '../../../data-access/cost.store';
import { COST_CATEGORIES, COST_CATEGORY_LABELS, CostCategory } from '../../../models/cost.model';
import { CostDialogsService } from '../cost-dialogs.service';

const ALL = 'ALL';

@Component({
  selector: 'app-entries-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-form-field class="toolbar__search" subscriptSizing="dynamic">
        <mat-label>Tìm nội dung, nhà cung cấp, số chứng từ</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="search" />
      </mat-form-field>
      <span class="toolbar__spacer"></span>
      @if (store.canManage()) {
        <button mat-flat-button type="button" [disabled]="!store.costItems().length" (click)="dialogs.addEntry()">
          <mat-icon>add</mat-icon> Ghi nhận chi phí
        </button>
      }
    </div>
    <div class="toolbar">
      <mat-chip-listbox
        aria-label="Lọc theo loại chi phí"
        [value]="store.entriesCategory() ?? allValue"
        [hideSingleSelectionIndicator]="true"
        (change)="onCategory($event)"
      >
        <mat-chip-option [value]="allValue">Tất cả</mat-chip-option>
        @for (category of categories; track category) {
          <mat-chip-option [value]="category">{{ categoryLabels[category] }}</mat-chip-option>
        }
      </mat-chip-listbox>
    </div>

    @if (store.entriesLoading()) {
      <mat-progress-bar mode="indeterminate" />
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
      <mat-paginator
        [length]="store.entriesTotal()"
        [pageIndex]="store.entriesPage() - 1"
        [pageSize]="store.pageSize()"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
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
  protected readonly search = new FormControl(this.store.entriesQuery(), { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.store.setEntriesFilter({ q }));
  }

  protected onCategory(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    void this.store.setEntriesFilter({ category: typeof value === 'string' && value !== ALL ? (value as CostCategory) : null });
  }

  protected onPage(event: PageEvent): void {
    void this.store.setEntriesFilter({ page: event.pageIndex + 1 });
  }
}
