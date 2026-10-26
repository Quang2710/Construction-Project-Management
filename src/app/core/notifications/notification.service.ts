import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Đóng', { duration: 3000, panelClass: 'snack-success' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Đóng', { duration: 5000, panelClass: 'snack-error' });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Đóng', { duration: 3000 });
  }

  /** Thông báo kèm nút hành động; trả về true nếu người dùng bấm nút. */
  async action(message: string, actionLabel: string, duration = 6000): Promise<boolean> {
    const ref = this.snackBar.open(message, actionLabel, { duration });
    const dismissed = await firstValueFrom(ref.afterDismissed());
    return dismissed.dismissedByAction;
  }
}
