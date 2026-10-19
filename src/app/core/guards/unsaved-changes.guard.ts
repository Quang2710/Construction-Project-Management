import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog/confirm-dialog.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Hỏi lại trước khi rời trang có form đang sửa dở. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }
  return inject(ConfirmDialogService).confirm({
    title: 'Rời trang?',
    message: 'Các thay đổi chưa lưu sẽ bị mất. Bạn có chắc muốn rời trang?',
    confirmText: 'Rời trang',
    cancelText: 'Ở lại',
    destructive: true,
  });
};
