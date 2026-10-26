import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { PERMISSIONS } from '../../../../core/auth/permissions';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { toApiError } from '../../../../shared/utils/api-error';
import { parseIsoDate } from '../../../../shared/utils/date.utils';
import { SiteDiariesApiService } from '../../data-access/site-diaries-api.service';
import { SiteDiary, WEATHER_ICONS, WEATHER_LABELS } from '../../models/site-diary.model';
import { DiaryStatusChipComponent } from '../diary-status-chip/diary-status-chip.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

const RECENT_COUNT = 10;

/** Tab "Nhật ký" trong trang chi tiết dự án: 10 nhật ký gần nhất. */
@Component({
  selector: 'app-project-diaries-panel',
  imports: [
    DatePipe,
    RouterLink,
    HasRoleDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    DiaryStatusChipComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-diaries-panel.component.html',
  styleUrl: './project-diaries-panel.component.scss',
})
export class ProjectDiariesPanelComponent {
  private readonly api = inject(SiteDiariesApiService);

  readonly projectId = input.required<string>();

  protected readonly permissions = PERMISSIONS;
  protected readonly weatherIcons = WEATHER_ICONS;
  protected readonly weatherLabels = WEATHER_LABELS;
  protected readonly diaries = signal<SiteDiary[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      untracked(() => void this.load(projectId));
    });
  }

  protected dateOf(diary: SiteDiary): Date {
    return parseIsoDate(diary.date);
  }

  protected async load(projectId = this.projectId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.list({ projectId, pageSize: RECENT_COUNT, sort: '-date' }));
      this.diaries.set(response.data);
      this.total.set(response.total);
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
