import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TabsModule } from 'primeng/tabs';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { BreadcrumbService } from '../../../../core/layout/breadcrumb/breadcrumb.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { ProjectDiariesPanelComponent } from '../../../site-diaries/components/project-diaries-panel/project-diaries-panel.component';
import { ProjectTasksPanelComponent } from '../../../tasks/components/project-tasks-panel/project-tasks-panel.component';
import { ProgressCompareComponent } from '../../components/progress-compare/progress-compare.component';
import { MapMarker, ProjectMapComponent } from '../../components/project-map/project-map.component';
import { ProjectStatusChipComponent } from '../../components/project-status-chip/project-status-chip.component';
import { ProjectDetailStore } from '../../data-access/project-detail.store';
import { PROJECT_STATUS_COLORS } from '../../utils/project-status.utils';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface PlaceholderTab {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

@Component({
  selector: 'app-project-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    DecimalPipe,
    TabsModule,
    HasRoleDirective,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    ProjectStatusChipComponent,
    ProgressCompareComponent,
    ProjectMapComponent,
    ProjectTasksPanelComponent,
    ProjectDiariesPanelComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
  ],
  providers: [ProjectDetailStore],
  templateUrl: './project-detail-page.component.html',
  styleUrl: './project-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailPageComponent {
  private readonly router = inject(Router);
  private readonly breadcrumbs = inject(BreadcrumbService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  protected readonly store = inject(ProjectDetailStore);

  /** Tham số :id của route. */
  readonly id = input.required<string>();

  protected readonly permissions = PERMISSIONS;
  protected readonly placeholderTabs: readonly PlaceholderTab[] = [
    { label: 'Chi phí', icon: 'payments', description: 'Dự toán, phát sinh và thanh toán theo hạng mục.' },
    { label: 'Tài liệu', icon: 'folder', description: 'Bản vẽ, hồ sơ pháp lý và biên bản nghiệm thu.' },
  ];

  protected readonly markers = computed<MapMarker[]>(() => {
    const project = this.store.project();
    return project
      ? [
          {
            id: project.id,
            lat: project.location.lat,
            lng: project.location.lng,
            title: project.name,
            color: PROJECT_STATUS_COLORS[project.status],
          },
        ]
      : [];
  });

  protected readonly budgetUsage = computed(() => {
    const project = this.store.project();
    return project && project.budget > 0 ? Math.round((project.actualCost / project.budget) * 100) : 0;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
    effect(() => {
      const project = this.store.project();
      if (project) {
        this.breadcrumbs.setLabel(`/projects/${project.id}`, project.code);
      }
    });
  }

  protected reload(): void {
    void this.store.load(this.id());
  }

  protected onTasksChanged(): void {
    void this.store.refresh();
  }

  protected async remove(): Promise<void> {
    const project = this.store.project();
    if (!project) {
      return;
    }
    const confirmed = await this.confirmDialog.confirm({
      title: 'Xoá dự án',
      message: `Xoá dự án "${project.name}" cùng toàn bộ công việc và bình luận? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xoá dự án',
      destructive: true,
    });
    if (confirmed && (await this.store.remove())) {
      this.notification.success(`Đã xoá dự án ${project.code}.`);
      await this.router.navigate(['/projects']);
    }
  }
}
