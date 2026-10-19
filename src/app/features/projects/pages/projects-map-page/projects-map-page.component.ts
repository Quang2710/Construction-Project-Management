import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { ProgressCompareComponent } from '../../components/progress-compare/progress-compare.component';
import { MapMarker, ProjectMapComponent } from '../../components/project-map/project-map.component';
import { ProjectStatusChipComponent } from '../../components/project-status-chip/project-status-chip.component';
import { ProjectsMapStore } from '../../data-access/projects-map.store';
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES, ProjectStatus } from '../../models/project.model';
import { PROJECT_STATUS_COLORS } from '../../utils/project-status.utils';

const ALL = 'ALL';

@Component({
  selector: 'app-projects-map-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    VndPipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ProjectMapComponent,
    ProjectStatusChipComponent,
    ProgressCompareComponent,
  ],
  providers: [ProjectsMapStore],
  templateUrl: './projects-map-page.component.html',
  styleUrl: './projects-map-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsMapPageComponent {
  protected readonly store = inject(ProjectsMapStore);

  protected readonly allValue = ALL;
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly statusColors = PROJECT_STATUS_COLORS;

  protected readonly markers = computed<MapMarker[]>(() =>
    this.store.filtered().map((project) => ({
      id: project.id,
      lat: project.location.lat,
      lng: project.location.lng,
      title: `${project.code} · ${project.name}`,
      color: PROJECT_STATUS_COLORS[project.status],
    })),
  );

  protected onStatusChange(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    this.store.setStatusFilter(typeof value === 'string' && value !== ALL ? (value as ProjectStatus) : null);
  }
}
