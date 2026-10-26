import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { getRouteBreadcrumb } from '../../auth/route-data';
import { BreadcrumbService } from './breadcrumb.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export interface BreadcrumbItem {
  readonly label: string;
  readonly url: string;
}

function buildBreadcrumbs(root: ActivatedRouteSnapshot): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];
  const segments: string[] = [];
  let route: ActivatedRouteSnapshot | null = root;

  while (route) {
    segments.push(...route.url.map((segment) => segment.path));
    const label = route.routeConfig ? getRouteBreadcrumb(route.routeConfig.data ?? {}) : null;
    if (label && items[items.length - 1]?.label !== label) {
      items.push({ label, url: '/' + segments.join('/') });
    }
    route = route.firstChild;
  }
  return items;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [
    RouterLink,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a class="breadcrumb__home" routerLink="/dashboard" aria-label="Trang chủ"><app-icon>home</app-icon></a>
      @for (item of items(); track item.url; let last = $last) {
        <app-icon class="breadcrumb__sep">chevron_right</app-icon>
        @if (last) {
          <span class="breadcrumb__current" aria-current="page">{{ item.label }}</span>
        } @else {
          <a class="breadcrumb__link" [routerLink]="item.url">{{ item.label }}</a>
        }
      }
    </nav>
  `,
  styles: `
    .breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 16px;
      font: var(--app-body-medium);
      color: var(--app-on-surface-variant);
    }
    .breadcrumb app-icon {
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
    .breadcrumb__home,
    .breadcrumb__link {
      display: inline-flex;
      color: inherit;
      text-decoration: none;
    }
    .breadcrumb__home:hover,
    .breadcrumb__link:hover {
      color: var(--app-primary);
    }
    .breadcrumb__current {
      color: var(--app-on-surface);
      font-weight: 500;
    }
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly breadcrumbs = inject(BreadcrumbService);

  private readonly baseItems = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => buildBreadcrumbs(this.router.routerState.snapshot.root)),
    ),
    { initialValue: buildBreadcrumbs(this.router.routerState.snapshot.root) },
  );

  protected readonly items = computed(() => {
    const overrides = this.breadcrumbs.overrides();
    return this.baseItems().map((item) => ({ ...item, label: overrides.get(item.url) ?? item.label }));
  });
}
