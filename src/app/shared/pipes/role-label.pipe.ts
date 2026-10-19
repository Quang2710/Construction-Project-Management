import { Pipe, PipeTransform } from '@angular/core';
import { ROLE_LABELS, UserRole } from '../models/user.model';

@Pipe({ name: 'roleLabel' })
export class RoleLabelPipe implements PipeTransform {
  transform(role: UserRole | null | undefined): string {
    return role ? ROLE_LABELS[role] : '';
  }
}
