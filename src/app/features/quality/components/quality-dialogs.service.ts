import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  InspectionCreateDialogComponent,
  InspectionCreateDialogData,
  InspectionCreateResult,
} from './inspection-create-dialog/inspection-create-dialog.component';
import { NoteDialogComponent, NoteDialogData } from './note-dialog/note-dialog.component';
import { PunchFormDialogComponent, PunchFormDialogData, PunchFormResult } from './punch-form-dialog/punch-form-dialog.component';
import { ReassignDialogComponent, ReassignDialogData, ReassignResult } from './reassign-dialog/reassign-dialog.component';
import { ResolveDialogComponent, ResolveResult } from './resolve-dialog/resolve-dialog.component';

const WIDE = { width: '640px', maxWidth: 'calc(100vw - 24px)' };
const NARROW = { width: '480px', maxWidth: 'calc(100vw - 32px)' };

/** Mở các dialog nghiệp vụ chất lượng; trả về dữ liệu người dùng nhập (undefined nếu huỷ). */
@Injectable({ providedIn: 'root' })
export class QualityDialogsService {
  private readonly dialog = inject(MatDialog);

  createInspection(data: InspectionCreateDialogData): Promise<InspectionCreateResult | undefined> {
    const ref = this.dialog.open<InspectionCreateDialogComponent, InspectionCreateDialogData, InspectionCreateResult>(
      InspectionCreateDialogComponent,
      { ...WIDE, data },
    );
    return firstValueFrom(ref.afterClosed());
  }

  punchForm(data: PunchFormDialogData): Promise<PunchFormResult | undefined> {
    const ref = this.dialog.open<PunchFormDialogComponent, PunchFormDialogData, PunchFormResult>(PunchFormDialogComponent, {
      ...WIDE,
      data,
    });
    return firstValueFrom(ref.afterClosed());
  }

  resolve(title: string): Promise<ResolveResult | undefined> {
    const ref = this.dialog.open<ResolveDialogComponent, string, ResolveResult>(ResolveDialogComponent, { ...WIDE, data: title });
    return firstValueFrom(ref.afterClosed());
  }

  note(data: NoteDialogData): Promise<string | undefined> {
    const ref = this.dialog.open<NoteDialogComponent, NoteDialogData, string>(NoteDialogComponent, { ...NARROW, data });
    return firstValueFrom(ref.afterClosed());
  }

  reassign(data: ReassignDialogData): Promise<ReassignResult | undefined> {
    const ref = this.dialog.open<ReassignDialogComponent, ReassignDialogData, ReassignResult>(ReassignDialogComponent, {
      ...NARROW,
      data,
    });
    return firstValueFrom(ref.afterClosed());
  }
}
