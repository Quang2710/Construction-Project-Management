import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SortEvent } from 'primeng/api';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { ProgressCompareComponent } from '../../components/progress-compare/progress-compare.component';
import { ProjectStatusChipComponent } from '../../components/project-status-chip/project-status-chip.component';
import { ProjectsListStore } from '../../data-access/projects-list.store';
import { fromAllOption, withAllOption } from '../../../../shared/utils/options';
import { Project, PROJECT_STATUS_LABELS, PROJECT_STATUSES, ProjectStatus } from '../../models/project.model';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

const ALL = 'ALL';

@Component({
  selector: 'app-project-list-page',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    PaginatorModule,
    SelectButtonModule,
    HasRoleDirective,
    VndPipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ProjectStatusChipComponent,
    ProgressCompareComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
    ...FIELD,
    InputTextModule,
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
  protected readonly statusOptions = withAllOption(PROJECT_STATUSES, PROJECT_STATUS_LABELS);
  protected readonly searchControl = new FormControl(this.store.q(), { nonNullable: true });

  protected readonly isCompact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly sortActive = computed(() => this.store.sort().replace(/^-/, ''));
  protected readonly sortOrder = computed(() => (this.store.sort().startsWith('-') ? -1 : 1));

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.store.setSearch(q));
  }

  protected onStatusChange(value: unknown): void {
    this.store.setStatus(fromAllOption<ProjectStatus>(value));
  }

  /** Chỉ cập nhật khi người dùng đổi cột/chiều sắp xếp (tránh về trang 1 khi bảng phát lại sự kiện). */
  protected onSort(event: SortEvent): void {
    const field = event.field ?? this.sortActive();
    const order = event.order === -1 ? -1 : 1;
    if (field !== this.sortActive() || order !== this.sortOrder()) {
      this.store.setSort(field, order === -1 ? 'desc' : 'asc');
    }
  }

  protected onPage(event: PaginatorState): void {
    this.store.setPage((event.page ?? 0) + 1, event.rows ?? this.store.pageSize());
  }

  protected openProject(project: Project): void {
    void this.router.navigate(['/projects', project.id]);
  }
}
