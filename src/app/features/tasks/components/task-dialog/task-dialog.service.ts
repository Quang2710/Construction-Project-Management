import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Task } from '../../models/task.model';
import { TaskDialogComponent, TaskDialogData, TaskDialogResult } from './task-dialog.component';

@Injectable({ providedIn: 'root' })
export class TaskDialogService {
  private readonly dialog = inject(MatDialog);

  /**
   * Mở dialog xem/sửa (task) hoặc tạo mới (projectId tuỳ chọn).
   * Trả về kết quả nếu dữ liệu đã thay đổi (kể cả khi đóng bằng nút X sau khi bình luận).
   */
  async open(data: { task?: Task; projectId?: string | null }): Promise<TaskDialogResult | undefined> {
    const ref = this.dialog.open<TaskDialogComponent, TaskDialogData, TaskDialogResult>(TaskDialogComponent, {
      data: { task: data.task ?? null, projectId: data.projectId ?? null },
      width: '920px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100dvh - 24px)',
      autoFocus: false,
      panelClass: 'task-dialog-panel',
    });
    const instance = ref.componentInstance;
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? instance.pendingResult();
  }
}
