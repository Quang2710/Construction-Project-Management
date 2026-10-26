import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getInitials } from '../../utils/string.utils';

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="avatar" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.4">{{ initials() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--app-primary-container);
      color: var(--app-on-primary-container);
      font-weight: 600;
      user-select: none;
    }
  `,
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(36);

  protected readonly initials = computed(() => getInitials(this.name()));
}
