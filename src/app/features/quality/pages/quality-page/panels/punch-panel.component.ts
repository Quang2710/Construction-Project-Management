import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { QualityDialogsService } from '../../../components/quality-dialogs.service';
import { QualityStatusChipComponent } from '../../../components/quality-status-chip/quality-status-chip.component';
import { SeverityBadgeComponent } from '../../../components/severity-badge/severity-badge.component';
import { QualityStore } from '../../../data-access/quality.store';
import {
  PUNCH_SEVERITIES,
  PUNCH_SEVERITY_LABELS,
  PUNCH_STATUS_LABELS,
  PUNCH_STATUSES,
  PunchItem,
  PunchSeverity,
  PunchStatus,
} from '../../../models/quality.model';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { ProgressBarModule } from 'primeng/progressbar';
import { FIELD } from '../../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { withAllOption } from '../../../../../shared/utils/options';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { ToggleButtonModule } from 'primeng/togglebutton';

const ALL = 'ALL';

@Component({
  selector: 'app-punch-panel',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    SelectButtonModule,
    PaginatorModule,
    SelectModule,
    ToggleButtonModule,
    EmptyStateComponent,
    ErrorStateComponent,
    QualityStatusChipComponent,
    SeverityBadgeComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
    ...FIELD,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar app-toolbar">
      <app-field class="toolbar__search" dense>
        <label fieldLabel>Tìm mã, lỗi, vị trí</label>
        <app-icon fieldPrefix>search</app-icon>
        <input pInputText [formControl]="search" />
      </app-field>
      <app-field dense>
        <label fieldLabel>Mức độ</label>
        <p-select
          [options]="severityFilterOptions"
          optionLabel="label"
          optionValue="value"
          [ngModel]="store.punchFilter().severity ?? allValue"
          (ngModelChange)="onSeverity($event)"
          [fluid]="true"
        />
      </app-field>
      <span class="toolbar__spacer"></span>
      @if (store.canEdit()) {
        <button pButton type="button" [disabled]="store.busy() || !store.members().length" (click)="create()">
          <app-icon>add_a_photo</app-icon> Ghi nhận lỗi
        </button>
      }
    </div>
    <div class="toolbar">
      <p-selectbutton class="app-chips" [options]="statusFilterOptions" optionLabel="label" optionValue="value" [allowEmpty]="false" [ngModel]="store.punchFilter().status ?? allValue" (onChange)="onStatus($event)" [attr.aria-label]="'Lọc theo trạng thái'" />
      <div class="quick" role="group" aria-label="Lọc nhanh">
        <p-togglebutton
          onLabel="Giao cho tôi"
          offLabel="Giao cho tôi"
          size="small"
          [ngModel]="store.punchFilter().mine"
          (onChange)="store.setPunchFilter({ mine: $event.checked })"
        />
        <p-togglebutton
          [onLabel]="overdueLabel()"
          [offLabel]="overdueLabel()"
          size="small"
          [ngModel]="store.punchFilter().overdue"
          (onChange)="store.setPunchFilter({ overdue: $event.checked })"
        />
      </div>
    </div>

    @if (store.punchLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
    }
    @if (store.punchError(); as error) {
      <app-error-state [message]="error" (retry)="store.loadPunchItems()" />
    } @else if (!store.punchLoading() && store.punchItems().length === 0) {
      <app-empty-state icon="task_alt" title="Không có lỗi cần xử lý" message="Thử bỏ bớt bộ lọc." />
    } @else {
      <ul class="cards">
        @for (item of store.punchItems(); track item.id) {
          <li>
            <button type="button" class="card" [class.card--overdue]="item.isOverdue" (click)="open(item)">
              @if (item.beforePhotos[0]; as photo) {
                <img class="card__thumb" [src]="photo.url" [alt]="'Ảnh hiện trạng ' + item.code" loading="lazy" />
              }
              <span class="card__body">
                <span class="card__title">{{ item.code }} · {{ item.title }}</span>
                <span class="sub">{{ item.location || '—' }}{{ item.inspectionCode ? ' · ' + item.inspectionCode : '' }}</span>
                <span class="card__meta">
                  <app-quality-status-chip [status]="item.status" />
                  <app-severity-badge [severity]="item.severity" />
                </span>
                <span class="card__meta sub">
                  <span>{{ item.assignee?.fullName ?? 'Chưa giao' }}</span>
                  <span class="due" [class.due--overdue]="item.isOverdue">
                    <app-icon>{{ item.isOverdue ? 'alarm' : 'event' }}</app-icon>
                    {{ item.dueDate | date: 'dd/MM' }}{{ item.isOverdue ? ' · quá hạn' : '' }}
                  </span>
                </span>
              </span>
            </button>
          </li>
        }
      </ul>
      <p-paginator [totalRecords]="store.punchTotal()" [first]="(store.punchFilter().page - 1) * store.pageSize()" [rows]="store.pageSize()" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} / {totalRecords}" (onPageChange)="onPage($event)" />
    }
  `,
  styleUrl: './panels.scss',
})
export class PunchPanelComponent {
  private readonly router = inject(Router);
  private readonly dialogs = inject(QualityDialogsService);
  protected readonly store = inject(QualityStore);

  protected readonly allValue = ALL;
  protected readonly statuses = PUNCH_STATUSES;
  protected readonly statusLabels = PUNCH_STATUS_LABELS;
  protected readonly statusFilterOptions = withAllOption(this.statuses, this.statusLabels, 'Tất cả');
  protected readonly severities = PUNCH_SEVERITIES;
  protected readonly severityLabels = PUNCH_SEVERITY_LABELS;
  protected readonly severityFilterOptions = withAllOption(this.severities, this.severityLabels, 'Mọi mức độ');
  protected readonly overdueLabel = computed(() => (this.store.overdueCount() ? `Quá hạn (${this.store.overdueCount()})` : 'Quá hạn'));
  protected readonly search = new FormControl(this.store.punchFilter().q, { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.store.setPunchFilter({ q }));
  }

  protected onStatus(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    void this.store.setPunchFilter({ status: typeof value === 'string' && value !== ALL ? (value as PunchStatus) : null });
  }

  protected onSeverity(value: string): void {
    void this.store.setPunchFilter({ severity: value === ALL ? null : (value as PunchSeverity) });
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setPunchFilter({ page: (event.page ?? 0) + 1 });
  }

  protected open(item: PunchItem): void {
    void this.router.navigate(['/quality/punch', item.id]);
  }

  protected async create(): Promise<void> {
    const result = await this.dialogs.punchForm({ projectCode: this.store.project()?.code ?? '', members: this.store.members() });
    if (result) {
      await this.store.createPunchItem(result.draft, result.files);
    }
  }
}
