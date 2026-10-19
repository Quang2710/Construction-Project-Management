import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { UserRole } from '../models/user.model';

/**
 * Chỉ render nội dung khi user hiện tại có một trong các role chỉ định.
 *
 * @example <button *hasRole="['ADMIN', 'PROJECT_MANAGER']">Xoá</button>
 */
@Directive({
  selector: '[hasRole]',
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  readonly hasRole = input.required<readonly UserRole[]>();

  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.hasAnyRole(this.hasRole());
      if (allowed && !this.rendered) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.viewContainer.clear();
        this.rendered = false;
      }
    });
  }
}
