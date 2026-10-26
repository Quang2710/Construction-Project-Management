import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { ProgressBarModule } from 'primeng/progressbar';
import { FIELD } from '../../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';

const ALL = 'ALL';
const AWAITING = 'AWAITING';

@Component({
  selector: 'app-inspections-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    SelectButtonModule,
    PaginatorModule,
    EmptyStateComponent,
    ErrorStateComponent,
    QualityStatusChipComponent,
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
        <label fieldLabel>Tìm mã, tên phiếu, vị trí</label>
        <app-icon fieldPrefix>search</app-icon>
        <input pInputText [formControl]="search" />
      </app-field>
      <span class="toolbar__spacer"></span>
      @if (store.canEdit()) {
        <button pButton type="button" [disabled]="store.busy() || !store.wbs().length" (click)="create()">
          <app-icon>add</app-icon> Lập phiếu nghiệm thu
        </button>
      }
    </div>
    <div class="toolbar">
      <p-selectbutton class="app-chips"
        [options]="filterOptions()"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ngModel]="selected()"
        (onChange)="onFilter($event)"
        [attr.aria-label]="'Lọc phiếu nghiệm thu'"
      />
    </div>

    @if (store.inspectionsLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
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
                    <span class="counts__pass"><app-icon>check</app-icon>{{ inspection.stats.pass }}</span>
                    @if (inspection.stats.fail) {
                      <span class="counts__fail"><app-icon>close</app-icon>{{ inspection.stats.fail }}</span>
                    }
                    @if (inspection.stats.pending) {
                      <span class="counts__pending"><app-icon>more_horiz</app-icon>{{ inspection.stats.pending }}</span>
                    }
                  </span>
                </td>
                <td><app-quality-status-chip [status]="inspection.status" [level]="inspection.currentLevel" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p-paginator [totalRecords]="store.inspectionsTotal()" [first]="(store.inspectionFilter().page - 1) * store.pageSize()" [rows]="store.pageSize()" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
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

  /** "Chờ tôi duyệt" chỉ hiện với người tham gia duyệt, kèm số phiếu đang chờ. */
  protected readonly filterOptions = computed(() => {
    const awaiting = this.store.awaitingCount();
    return [
      { label: 'Tất cả', value: ALL },
      ...(this.canApprove() ? [{ label: awaiting ? `Chờ tôi duyệt (${awaiting})` : 'Chờ tôi duyệt', value: AWAITING }] : []),
      ...INSPECTION_STATUSES.map((status) => ({ label: INSPECTION_STATUS_LABELS[status], value: status })),
    ];
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

  protected onFilter(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    if (value === AWAITING) {
      void this.store.setInspectionFilter({ awaitingMe: true, status: null });
      return;
    }
    const status = typeof value === 'string' && value !== ALL ? (value as InspectionStatus) : null;
    void this.store.setInspectionFilter({ awaitingMe: false, status });
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setInspectionFilter({ page: (event.page ?? 0) + 1 });
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
