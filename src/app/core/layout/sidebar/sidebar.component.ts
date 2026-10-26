import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { AuthStore } from '../../auth/auth.store';
import { APP_NAME } from '../../config/app-title.strategy';
import { filterNavSections, NAV_SECTIONS } from '../navigation';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    IconComponent,
    TooltipModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.collapsed]': 'collapsed()' },
})
export class SidebarComponent {
  private readonly auth = inject(AuthStore);

  readonly collapsed = input(false);
  /** Phát ra khi người dùng bấm một mục menu (để đóng drawer trên mobile). */
  readonly navigated = output<void>();

  protected readonly appName = APP_NAME;
  protected readonly sections = computed(() => filterNavSections(NAV_SECTIONS, this.auth.role()));
}
