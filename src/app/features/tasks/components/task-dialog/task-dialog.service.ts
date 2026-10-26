import { inject, Injectable } from '@angular/core';
import { AppDialog } from '../../../../shared/ui/dialog/app-dialog.service';
import { firstValueFrom } from 'rxjs';
import { Task } from '../../models/task.model';
import { TaskDialogComponent, TaskDialogData, TaskDialogResult } from './task-dialog.component';

@Injectable({ providedIn: 'root' })
export class TaskDialogService {
  private readonly dialog = inject(AppDialog);

  /**
   * Mở dialog xem/sửa (task) hoặc tạo mới (projectId tuỳ chọn).
   * Trả về kết quả nếu dữ liệu đã thay đổi (kể cả khi đóng bằng nút X sau khi bình luận).
   */
  async open(data: { task?: Task; projectId?: string | null }): Promise<TaskDialogResult | undefined> {
    const ref = this.dialog.open<TaskDialogComponent, TaskDialogData, TaskDialogResult>(TaskDialogComponent, {
      data: { task: data.task ?? null, projectId: data.projectId ?? null },
      width: '920px',
      maxWidth: 'calc(100vw - 24px)',
      panelClass: 'task-dialog-panel',
      // Form dài: bấm ra ngoài không đóng để tránh mất dữ liệu đang nhập.
      dismissable: false,
    });
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? ref.componentInstance()?.pendingResult();
  }
}
