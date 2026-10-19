import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../../auth/auth.store';
import { APP_NAME } from '../../config/app-title.strategy';
import { filterNavSections, NAV_SECTIONS } from '../navigation';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule, MatTooltipModule],
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
