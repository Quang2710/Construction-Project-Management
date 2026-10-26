import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { map } from 'rxjs';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { LayoutStore } from '../layout.store';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/** Dưới mốc này (điện thoại, tablet dọc) sidebar chuyển sang dạng drawer. */
const COMPACT_QUERY = '(max-width: 959.98px)';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    DrawerModule,
    SidebarComponent,
    TopbarComponent,
    BreadcrumbComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  protected readonly layout = inject(LayoutStore);

  protected readonly isCompact = toSignal(
    inject(BreakpointObserver)
      .observe(COMPACT_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly sidebarCollapsed = computed(() => !this.isCompact() && this.layout.sidebarCollapsed());

  protected toggleNav(): void {
    if (this.isCompact()) {
      this.layout.toggleMobileNav();
    } else {
      this.layout.toggleSidebar();
    }
  }

  protected onNavigated(): void {
    if (this.isCompact()) {
      this.layout.closeMobileNav();
    }
  }
}
