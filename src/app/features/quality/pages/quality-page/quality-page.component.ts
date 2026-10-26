import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { QualityStore } from '../../data-access/quality.store';
import { InspectionsPanelComponent } from './panels/inspections-panel.component';
import { PunchPanelComponent } from './panels/punch-panel.component';

type QualityTab = 'inspections' | 'punch';
const TABS: readonly QualityTab[] = ['inspections', 'punch'];

@Component({
  selector: 'app-quality-page',
  imports: [
    MatFormFieldModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InspectionsPanelComponent,
    PunchPanelComponent,
  ],
  providers: [QualityStore],
  template: `
    <app-page-header title="Chất lượng" subtitle="Nghiệm thu theo hạng mục, duyệt nhiều cấp và punch list lỗi cần xử lý" />

    @if (store.projectsLoading()) {
      <mat-progress-bar mode="indeterminate" />
    }
    @if (store.projectsError(); as error) {
      <app-error-state [message]="error" (retry)="reload()" />
    } @else if (!store.projectsLoading() && store.projects().length === 0) {
      <app-empty-state icon="fact_check" title="Chưa có dự án đang thi công" message="Bạn chưa được gán vào dự án nào." />
    } @else if (store.projectId()) {
      <mat-form-field class="project" subscriptSizing="dynamic">
        <mat-label>Dự án</mat-label>
        <mat-select [value]="store.projectId()" (valueChange)="onProject($event)">
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
        (selectedIndexChange)="onTab($event)"
      >
        <mat-tab>
          <ng-template mat-tab-label>
            Nghiệm thu
            @if (store.awaitingCount()) {
              <span class="badge" [attr.aria-label]="store.awaitingCount() + ' phiếu chờ bạn duyệt'">{{ store.awaitingCount() }}</span>
            }
          </ng-template>
          <ng-template matTabContent><app-inspections-panel /></ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            Punch list
            @if (store.overdueCount()) {
              <span class="badge badge--error" [attr.aria-label]="store.overdueCount() + ' lỗi quá hạn'">{{ store.overdueCount() }}</span>
            }
          </ng-template>
          <ng-template matTabContent><app-punch-panel /></ng-template>
        </mat-tab>
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
    .badge--error {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
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

  protected onTab(index: number): void {
    this.syncQuery({ tab: TABS[index] });
  }

  private syncQuery(params: { projectId?: string; tab?: QualityTab }): void {
    void this.router.navigate([], {
      queryParams: { projectId: this.store.projectId(), ...params },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
