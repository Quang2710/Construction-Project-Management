import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { ProgressCompareComponent } from '../../components/progress-compare/progress-compare.component';
import { ProjectStatusChipComponent } from '../../components/project-status-chip/project-status-chip.component';
import { ProjectsListStore } from '../../data-access/projects-list.store';
import { Project, PROJECT_STATUS_LABELS, PROJECT_STATUSES, ProjectStatus } from '../../models/project.model';

const ALL = 'ALL';
const FULL_COLUMNS = ['code', 'name', 'startDate', 'budget', 'progress', 'status', 'alerts'];
const COMPACT_COLUMNS = ['name', 'progress', 'status'];

@Component({
  selector: 'app-project-list-page',
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    HasRoleDirective,
    VndPipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ProjectStatusChipComponent,
    ProgressCompareComponent,
  ],
  providers: [ProjectsListStore],
  templateUrl: './project-list-page.component.html',
  styleUrl: './project-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListPageComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(ProjectsListStore);

  protected readonly permissions = PERMISSIONS;
  protected readonly allValue = ALL;
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly searchControl = new FormControl(this.store.q(), { nonNullable: true });

  private readonly isCompact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly columns = computed(() => (this.isCompact() ? COMPACT_COLUMNS : FULL_COLUMNS));
  protected readonly sortActive = computed(() => this.store.sort().replace(/^-/, ''));
  protected readonly sortDirection = computed(() => (this.store.sort().startsWith('-') ? 'desc' : 'asc'));

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.store.setSearch(q));
  }

  protected onStatusChange(event: MatChipListboxChange): void {
    const value: unknown = event.value;
    this.store.setStatus(typeof value === 'string' && value !== ALL ? (value as ProjectStatus) : null);
  }

  protected onSort(sort: Sort): void {
    this.store.setSort(sort.active, sort.direction);
  }

  protected onPage(event: PageEvent): void {
    this.store.setPage(event.pageIndex + 1, event.pageSize);
  }

  protected openProject(project: Project): void {
    void this.router.navigate(['/projects', project.id]);
  }
}
