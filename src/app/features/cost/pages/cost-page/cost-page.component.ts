import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
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
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

@Component({
  selector: 'app-cost-page',
  imports: [
    FormsModule,
    TabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    OverviewPanelComponent,
    EntriesPanelComponent,
    ChangeOrdersPanelComponent,
    PaymentsPanelComponent,
    ProfitLossPanelComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
    ProgressSpinnerModule,
    ...FIELD,
    SelectModule,
  ],
  providers: [CostStore, CostDialogsService, provideCharts(withDefaultRegisterables())],
  template: `
    <app-page-header title="Ngân sách" subtitle="Dự toán theo hạng mục, chi phí thực tế, phát sinh và thanh toán theo đợt">
      <button pButton outlined type="button" [disabled]="!store.summary() || store.exporting()" (click)="store.exportProject()">
        @if (store.exporting()) {
          <p-progress-spinner strokeWidth="6" ariaLabel="Đang xử lý" style="width: 18px; height: 18px" />
        } @else {
          <app-icon>download</app-icon>
        }
        Xuất Excel dự án
      </button>
    </app-page-header>

    @if (store.projectsLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
    }
    @if (store.projectsError(); as error) {
      <app-error-state [message]="error" (retry)="reload()" />
    } @else if (!store.projectsLoading() && store.projects().length === 0) {
      <app-empty-state icon="payments" title="Chưa có dự án" message="Bạn chưa được gán vào dự án nào." />
    } @else if (store.projectId()) {
      <app-field class="project" dense>
        <label fieldLabel>Dự án</label>
        <p-select [ngModel]="store.projectId()" (ngModelChange)="store.setProject($event)" [options]="store.projects()" optionValue="id" placeholder="Chọn…" [filter]="true" filterBy="code,name" emptyFilterMessage="Không tìm thấy dự án" [fluid]="true">
          <ng-template #selectedItem let-project>{{ project.code }} · {{ project.name }}</ng-template>
          <ng-template #item let-project>{{ project.code }} · {{ project.name }}</ng-template>
        </p-select>
      </app-field>

      <p-tabs [value]="tabIndex()" (valueChange)="onTabChange($event)" [lazy]="true" [scrollable]="true">
        <p-tablist>
          <p-tab [value]="0">
            Tổng quan
            @if (store.overrunItems().length) {
              <span class="badge badge--warn" [attr.aria-label]="store.overrunItems().length + ' hạng mục cần chú ý'">{{ store.overrunItems().length }}</span>
            }
          </p-tab>
          <p-tab [value]="1">Chi phí thực tế</p-tab>
          <p-tab [value]="2">
            Phát sinh
            @if (store.pendingChangeOrders().length) {
              <span class="badge" [attr.aria-label]="store.pendingChangeOrders().length + ' phát sinh chờ quyết định'">{{ store.pendingChangeOrders().length }}</span>
            }
          </p-tab>
          <p-tab [value]="3">
            Thanh toán
            @if (store.overduePayments().length) {
              <span class="badge badge--error" [attr.aria-label]="store.overduePayments().length + ' đợt quá hạn'">{{ store.overduePayments().length }}</span>
            }
          </p-tab>
          @if (store.canManage()) {
            <p-tab [value]="4">Lãi/lỗ các dự án</p-tab>
          }
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel [value]="0">
            <ng-template #content>
              <app-overview-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="1">
            <ng-template #content>
              <app-entries-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="2">
            <ng-template #content>
              <app-change-orders-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="3">
            <ng-template #content>
              <app-payments-panel />
            </ng-template>
          </p-tabpanel>
          @if (store.canManage()) {
            <p-tabpanel [value]="4">
              <ng-template #content>
                <app-profit-loss-panel (openProject)="openProject($event)" />
              </ng-template>
            </p-tabpanel>
          }
        </p-tabpanels>
      </p-tabs>
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
      background: var(--app-tertiary);
      color: var(--app-on-tertiary);
      font: var(--app-label-small);
      line-height: 20px;
      text-align: center;
    }
    .badge--warn {
      background: var(--app-warning-container);
      color: var(--app-on-warning-container);
    }
    .badge--error {
      background: var(--app-error);
      color: var(--app-on-error);
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

  protected onTabChange(value: string | number | undefined): void {
    this.tabIndex.set(Number(value ?? 0));
  }

  protected openProject(projectId: string): void {
    this.tabIndex.set(0);
    void this.store.setProject(projectId);
  }
}
