import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { QualityStore } from '../../data-access/quality.store';
import { InspectionsPanelComponent } from './panels/inspections-panel.component';
import { PunchPanelComponent } from './panels/punch-panel.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

type QualityTab = 'inspections' | 'punch';
const TABS: readonly QualityTab[] = ['inspections', 'punch'];

@Component({
  selector: 'app-quality-page',
  imports: [
    FormsModule,
    TabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InspectionsPanelComponent,
    PunchPanelComponent,
    ProgressBarModule,
    ...FIELD,
    SelectModule,
  ],
  providers: [QualityStore],
  template: `
    <app-page-header title="Chất lượng" subtitle="Nghiệm thu theo hạng mục, duyệt nhiều cấp và punch list lỗi cần xử lý" />

    @if (store.projectsLoading()) {
      <p-progressbar mode="indeterminate" styleClass="app-loading-bar" />
    }
    @if (store.projectsError(); as error) {
      <app-error-state [message]="error" (retry)="reload()" />
    } @else if (!store.projectsLoading() && store.projects().length === 0) {
      <app-empty-state icon="fact_check" title="Chưa có dự án đang thi công" message="Bạn chưa được gán vào dự án nào." />
    } @else if (store.projectId()) {
      <app-field class="project" dense>
        <label fieldLabel>Dự án</label>
        <p-select [ngModel]="store.projectId()" (ngModelChange)="onProject($event)" [options]="store.projects()" optionValue="id" placeholder="Chọn…" [filter]="true" filterBy="code,name" emptyFilterMessage="Không tìm thấy dự án" [fluid]="true">
          <ng-template #selectedItem let-project>{{ project.code }} · {{ project.name }}</ng-template>
          <ng-template #item let-project>{{ project.code }} · {{ project.name }}</ng-template>
        </p-select>
      </app-field>

      <p-tabs [value]="tabIndex()" (valueChange)="onTab($event)" [lazy]="true" [scrollable]="true">
        <p-tablist>
          <p-tab [value]="0">
            Nghiệm thu
            @if (store.awaitingCount()) {
              <span class="badge" [attr.aria-label]="store.awaitingCount() + ' phiếu chờ bạn duyệt'">{{ store.awaitingCount() }}</span>
            }
          </p-tab>
          <p-tab [value]="1">
            Punch list
            @if (store.overdueCount()) {
              <span class="badge badge--error" [attr.aria-label]="store.overdueCount() + ' lỗi quá hạn'">{{ store.overdueCount() }}</span>
            }
          </p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel [value]="0">
            <ng-template #content>
              <app-inspections-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="1">
            <ng-template #content>
              <app-punch-panel />
            </ng-template>
          </p-tabpanel>
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
    .badge--error {
      background: var(--app-error);
      color: var(--app-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityPageComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly store = inject(QualityStore);

  /** ?projectId=&tab= (giữ ngữ cảnh khi quay lại từ trang chi tiết). */
  readonly projectId = input<string>();
  readonly tab = input<string>();

  protected readonly tabIndex = computed(() => Math.max(0, TABS.indexOf(this.tab() as QualityTab)));

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    void this.store.init(this.projectId() ?? null);
  }

  protected onProject(projectId: string): void {
    void this.store.setProject(projectId);
    this.syncQuery({ projectId });
  }

  protected onTab(value: string | number | undefined): void {
    this.syncQuery({ tab: TABS[Number(value ?? 0)] });
  }

  private syncQuery(params: { projectId?: string; tab?: QualityTab }): void {
    void this.router.navigate([], {
      queryParams: { projectId: this.store.projectId(), ...params },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
