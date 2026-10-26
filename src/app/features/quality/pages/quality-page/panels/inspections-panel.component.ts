import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { QualityDialogsService } from '../../../components/quality-dialogs.service';
import { QualityStatusChipComponent } from '../../../components/quality-status-chip/quality-status-chip.component';
import { QualityStore } from '../../../data-access/quality.store';
import {
  INSPECTION_APPROVAL_LEVELS,
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUSES,
  Inspection,
  InspectionStatus,
} from '../../../models/quality.model';

const ALL = 'ALL';
const AWAITING = 'AWAITING';

@Component({
  selector: 'app-inspections-panel',
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
    EmptyStateComponent,
    ErrorStateComponent,
    QualityStatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-form-field class="toolbar__search" subscriptSizing="dynamic">
        <mat-label>Tìm mã, tên phiếu, vị trí</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="search" />
      </mat-form-field>
      <span class="toolbar__spacer"></span>
      @if (store.canEdit()) {
        <button mat-flat-button type="button" [disabled]="store.busy() || !store.wbs().length" (click)="create()">
          <mat-icon>add</mat-icon> Lập phiếu nghiệm thu
        </button>
      }
    </div>
    <div class="toolbar">
      <mat-chip-listbox aria-label="Lọc phiếu nghiệm thu" [value]="selected()" [hideSingleSelectionIndicator]="true" (change)="onFilter($event)">
        <mat-chip-option [value]="allValue">Tất cả</mat-chip-option>
        @if (canApprove()) {
          <mat-chip-option [value]="awaitingValue">
            Chờ tôi duyệt
            @if (store.awaitingCount()) {
              ({{ store.awaitingCount() }})
            }
          </mat-chip-option>
        }
        @for (status of statuses; track status) {
          <mat-chip-option [value]="status">{{ statusLabels[status] }}</mat-chip-option>
        }
      </mat-chip-listbox>
    </div>

    @if (store.inspectionsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.inspectionsError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadInspections()" />
    } @else if (!store.inspectionsLoading() && store.inspections().length === 0) {
      <app-empty-state
        icon="fact_check"
        title="Không có phiếu nghiệm thu"
        [message]="store.inspectionFilter().awaitingMe ? 'Không có phiếu nào đang chờ bạn duyệt.' : ''"
      />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Phiếu</th>
              <th class="hide-sm">Ngày</th>
              <th>Kết quả</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            @for (inspection of store.inspections(); track inspection.id) {
              <tr class="row--clickable" tabindex="0" (click)="open(inspection)" (keydown.enter)="open(inspection)">
                <td>
                  <div class="name">{{ inspection.code }} · {{ inspection.title }}</div>
                  <div class="sub">{{ inspection.wbsName }}{{ inspection.location ? ' · ' + inspection.location : '' }}</div>
                </td>
                <td class="hide-sm">{{ inspection.inspectionDate | date: 'dd/MM/yyyy' }}</td>
                <td>
                  <span class="counts" [attr.aria-label]="inspection.stats.pass + ' đạt, ' + inspection.stats.fail + ' không đạt'">
                    <span class="counts__pass"><mat-icon>check</mat-icon>{{ inspection.stats.pass }}</span>
                    @if (inspection.stats.fail) {
                      <span class="counts__fail"><mat-icon>close</mat-icon>{{ inspection.stats.fail }}</span>
                    }
                    @if (inspection.stats.pending) {
                      <span class="counts__pending"><mat-icon>more_horiz</mat-icon>{{ inspection.stats.pending }}</span>
                    }
                  </span>
                </td>
                <td><app-quality-status-chip [status]="inspection.status" [level]="inspection.currentLevel" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <mat-paginator
        [length]="store.inspectionsTotal()"
        [pageIndex]="store.inspectionFilter().page - 1"
        [pageSize]="store.pageSize()"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
    }
  `,
  styleUrl: './panels.scss',
})
export class InspectionsPanelComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(QualityDialogsService);
  protected readonly store = inject(QualityStore);

  protected readonly allValue = ALL;
  protected readonly awaitingValue = AWAITING;
  protected readonly statuses = INSPECTION_STATUSES;
  protected readonly statusLabels = INSPECTION_STATUS_LABELS;
  protected readonly search = new FormControl(this.store.inspectionFilter().q, { nonNullable: true });

  /** Có tham gia ít nhất một cấp duyệt. */
  protected readonly canApprove = computed(() => {
    const role = this.auth.role();
    return !!role && INSPECTION_APPROVAL_LEVELS.some((level) => level.roles.includes(role));
  });

  protected readonly selected = computed(() => {
    const filter = this.store.inspectionFilter();
    return filter.awaitingMe ? AWAITING : (filter.status ?? ALL);
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.store.setInspectionFilter({ q }));
  }

  protected onFilter(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    if (value === AWAITING) {
      void this.store.setInspectionFilter({ awaitingMe: true, status: null });
      return;
    }
    const status = typeof value === 'string' && value !== ALL ? (value as InspectionStatus) : null;
    void this.store.setInspectionFilter({ awaitingMe: false, status });
  }

  protected onPage(event: PageEvent): void {
    void this.store.setInspectionFilter({ page: event.pageIndex + 1 });
  }

  protected open(inspection: Inspection): void {
    void this.router.navigate(['/quality/inspections', inspection.id]);
  }

  protected async create(): Promise<void> {
    const result = await this.dialogs.createInspection({
      projectCode: this.store.project()?.code ?? '',
      wbs: this.store.wbs(),
      templates: this.store.templates(),
    });
    const created = result ? await this.store.createInspection(result) : null;
    if (created) {
      await this.router.navigate(['/quality/inspections', created.id]);
    }
  }
}
