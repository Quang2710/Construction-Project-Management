import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { CostStore } from '../../data-access/cost.store';
import { CostDialogsService } from './cost-dialogs.service';
import { ChangeOrdersPanelComponent } from './panels/change-orders-panel.component';
import { EntriesPanelComponent } from './panels/entries-panel.component';
import { OverviewPanelComponent } from './panels/overview-panel.component';
import { PaymentsPanelComponent } from './panels/payments-panel.component';
import { ProfitLossPanelComponent } from './panels/profit-loss-panel.component';

@Component({
  selector: 'app-cost-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    OverviewPanelComponent,
    EntriesPanelComponent,
    ChangeOrdersPanelComponent,
    PaymentsPanelComponent,
    ProfitLossPanelComponent,
  ],
  providers: [CostStore, CostDialogsService, provideCharts(withDefaultRegisterables())],
  template: `
    <app-page-header title="Ngân sách" subtitle="Dự toán theo hạng mục, chi phí thực tế, phát sinh và thanh toán theo đợt">
      <button mat-stroked-button type="button" [disabled]="!store.summary() || store.exporting()" (click)="store.exportProject()">
        @if (store.exporting()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>download</mat-icon>
        }
        Xuất Excel dự án
      </button>
    </app-page-header>

    @if (store.projectsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.projectsError(); as error) {
      <app-error-state [message]="error" (retry)="reload()" />
    } @else if (!store.projectsLoading() && store.projects().length === 0) {
      <app-empty-state icon="payments" title="Chưa có dự án" message="Bạn chưa được gán vào dự án nào." />
    } @else if (store.projectId()) {
      <mat-form-field class="project" subscriptSizing="dynamic">
        <mat-label>Dự án</mat-label>
        <mat-select [value]="store.projectId()" (valueChange)="store.setProject($event)">
          @for (project of store.projects(); track project.id) {
            <mat-option [value]="project.id">{{ project.code }} · {{ project.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-tab-group
        mat-stretch-tabs="false"
        mat-align-tabs="start"
        animationDuration="150ms"
        [selectedIndex]="tabIndex()"
        (selectedIndexChange)="tabIndex.set($event)"
      >
        <mat-tab>
          <ng-template mat-tab-label>
            Tổng quan
            @if (store.overrunItems().length) {
              <span class="badge badge--warn" [attr.aria-label]="store.overrunItems().length + ' hạng mục cần chú ý'">
                {{ store.overrunItems().length }}
              </span>
            }
          </ng-template>
          <ng-template matTabContent><app-overview-panel /></ng-template>
        </mat-tab>
        <mat-tab label="Chi phí thực tế">
          <ng-template matTabContent><app-entries-panel /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            Phát sinh
            @if (store.pendingChangeOrders().length) {
              <span class="badge" [attr.aria-label]="store.pendingChangeOrders().length + ' phát sinh chờ quyết định'">
                {{ store.pendingChangeOrders().length }}
              </span>
            }
          </ng-template>
          <ng-template matTabContent><app-change-orders-panel /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            Thanh toán
            @if (store.overduePayments().length) {
              <span class="badge badge--error" [attr.aria-label]="store.overduePayments().length + ' đợt quá hạn'">
                {{ store.overduePayments().length }}
              </span>
            }
          </ng-template>
          <ng-template matTabContent><app-payments-panel /></ng-template>
        </mat-tab>
        @if (store.canManage()) {
          <mat-tab label="Lãi/lỗ các dự án">
            <ng-template matTabContent><app-profit-loss-panel (openProject)="openProject($event)" /></ng-template>
          </mat-tab>
        }
      </mat-tab-group>
    }
  `,
  styles: `
    .project {
      width: min(420px, 100%);
      margin-bottom: 8px;
    }
    .badge {
      min-width: 20px;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--mat-sys-tertiary);
      color: var(--mat-sys-on-tertiary);
      font: var(--mat-sys-label-small);
      line-height: 20px;
      text-align: center;
    }
    .badge--warn {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    .badge--error {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostPageComponent implements OnInit {
  protected readonly store = inject(CostStore);
  protected readonly tabIndex = signal(0);

  /** ?projectId= khi mở từ trang chi tiết dự án. */
  readonly projectId = input<string>();

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    void this.store.init(this.projectId() ?? null);
  }

  protected openProject(projectId: string): void {
    this.tabIndex.set(0);
    void this.store.setProject(projectId);
  }
}
