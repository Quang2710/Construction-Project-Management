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
import { MatSelectModule } from '@angular/material/select';
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

const ALL = 'ALL';

@Component({
  selector: 'app-punch-panel',
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
    MatSelectModule,
    EmptyStateComponent,
    ErrorStateComponent,
    QualityStatusChipComponent,
    SeverityBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-form-field class="toolbar__search" subscriptSizing="dynamic">
        <mat-label>Tìm mã, lỗi, vị trí</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="search" />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Mức độ</mat-label>
        <mat-select [value]="store.punchFilter().severity ?? allValue" (valueChange)="onSeverity($event)">
          <mat-option [value]="allValue">Tất cả</mat-option>
          @for (severity of severities; track severity) {
            <mat-option [value]="severity">{{ severityLabels[severity] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <span class="toolbar__spacer"></span>
      @if (store.canEdit()) {
        <button mat-flat-button type="button" [disabled]="store.busy() || !store.members().length" (click)="create()">
          <mat-icon>add_a_photo</mat-icon> Ghi nhận lỗi
        </button>
      }
    </div>
    <div class="toolbar">
      <mat-chip-listbox
        aria-label="Lọc theo trạng thái"
        [value]="store.punchFilter().status ?? allValue"
        [hideSingleSelectionIndicator]="true"
        (change)="onStatus($event)"
      >
        <mat-chip-option [value]="allValue">Tất cả</mat-chip-option>
        @for (status of statuses; track status) {
          <mat-chip-option [value]="status">{{ statusLabels[status] }}</mat-chip-option>
        }
      </mat-chip-listbox>
      <mat-chip-listbox aria-label="Lọc nhanh" [multiple]="true">
        <mat-chip-option [selected]="store.punchFilter().mine" (selectionChange)="store.setPunchFilter({ mine: $event.selected })">
          Giao cho tôi
        </mat-chip-option>
        <mat-chip-option [selected]="store.punchFilter().overdue" (selectionChange)="store.setPunchFilter({ overdue: $event.selected })">
          Quá hạn
          @if (store.overdueCount()) {
            ({{ store.overdueCount() }})
          }
        </mat-chip-option>
      </mat-chip-listbox>
    </div>

    @if (store.punchLoading()) {
      <mat-progress-bar mode="indeterminate" />
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
                    <mat-icon>{{ item.isOverdue ? 'alarm' : 'event' }}</mat-icon>
                    {{ item.dueDate | date: 'dd/MM' }}{{ item.isOverdue ? ' · quá hạn' : '' }}
                  </span>
                </span>
              </span>
            </button>
          </li>
        }
      </ul>
      <mat-paginator
        [length]="store.punchTotal()"
        [pageIndex]="store.punchFilter().page - 1"
        [pageSize]="store.pageSize()"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
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
  protected readonly severities = PUNCH_SEVERITIES;
  protected readonly severityLabels = PUNCH_SEVERITY_LABELS;
  protected readonly search = new FormControl(this.store.punchFilter().q, { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.store.setPunchFilter({ q }));
  }

  protected onStatus(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    void this.store.setPunchFilter({ status: typeof value === 'string' && value !== ALL ? (value as PunchStatus) : null });
  }

  protected onSeverity(value: string): void {
    void this.store.setPunchFilter({ severity: value === ALL ? null : (value as PunchSeverity) });
  }

  protected onPage(event: PageEvent): void {
    void this.store.setPunchFilter({ page: event.pageIndex + 1 });
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
