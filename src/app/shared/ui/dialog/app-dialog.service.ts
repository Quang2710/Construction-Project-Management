import { Directive, inject, Injectable, input, Type } from '@angular/core';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Observable, of, take } from 'rxjs';

export interface AppDialogConfig<D> {
  readonly data?: D;
  /** Độ rộng mong muốn (vd. '560px'); màn hình hẹp tự co về gần full width. */
  readonly width?: string;
  readonly maxWidth?: string;
  /** Class thêm vào khung dialog (vd. 'lightbox-panel'). */
  readonly panelClass?: string;
  /** false: bấm ra ngoài không đóng (form dài dễ mất dữ liệu). Mặc định true. */
  readonly dismissable?: boolean;
}

export interface AppDialogRef<R, C = unknown> {
  afterClosed(): Observable<R | undefined>;
  close(result?: R): void;
  /** Instance của component trong dialog (null cho tới khi dialog vẽ xong). */
  componentInstance(): C | null;
}

/**
 * Mở dialog bằng PrimeNG DynamicDialog với API quen thuộc kiểu `open(Component, { data }) → afterClosed()`.
 * Component trong dialog tự vẽ tiêu đề / nội dung / nút bằng các thuộc tính
 * [dialogTitle] / [dialogContent] / [dialogActions] (style ở styles.scss).
 */
@Injectable({ providedIn: 'root' })
export class AppDialog {
  private readonly dialogs = inject(DialogService);

  open<C, D = unknown, R = unknown>(component: Type<C>, config: AppDialogConfig<D> = {}): AppDialogRef<R, C> {
    const ref = this.dialogs.open(component, {
      data: config.data,
      width: config.width ?? '560px',
      style: { maxWidth: config.maxWidth ?? 'calc(100vw - 24px)' },
      modal: true,
      showHeader: false,
      closable: false,
      closeOnEscape: true,
      dismissableMask: config.dismissable ?? true,
      focusOnShow: true,
      styleClass: ['app-dialog', config.panelClass].filter(Boolean).join(' '),
    });
    let instance: C | null = null;
    ref?.onChildComponentLoaded.pipe(take(1)).subscribe((loaded) => (instance = loaded as C));
    return {
      afterClosed: () => (ref ? (ref.onClose.pipe(take(1)) as Observable<R | undefined>) : of(undefined)),
      close: (result) => ref?.close(result),
      componentInstance: () => instance,
    };
  }
}

/** Dữ liệu truyền vào dialog qua AppDialog.open(..., { data }). */
export function injectDialogData<D>(): D {
  return inject(DynamicDialogConfig).data as D;
}

/** Đóng dialog hiện tại, trả kết quả cho afterClosed(). */
export function injectDialogRef<R>(): { close(result?: R): void } {
  const ref = inject(DynamicDialogRef);
  return { close: (result?: R) => ref.close(result) };
}

/** `<button appDialogClose>` / `<button [appDialogClose]="kết quả">`: đóng dialog khi bấm. */
@Directive({ selector: '[appDialogClose]', host: { '(click)': 'onClick()' } })
export class DialogCloseDirective {
  private readonly ref = inject(DynamicDialogRef);
  readonly appDialogClose = input<unknown>(undefined);

  protected onClick(): void {
    const value = this.appDialogClose();
    this.ref.close(value === '' ? undefined : value);
  }
}
