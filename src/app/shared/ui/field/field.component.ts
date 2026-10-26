import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgControl } from '@angular/forms';

let nextId = 0;

/** Thông báo lỗi của trường; chỉ hiện khi control không hợp lệ và người dùng đã chạm vào. */
@Component({
  selector: 'app-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-field__error' },
  template: `<ng-content />`,
})
export class FieldErrorComponent {}

/** Nội dung đặt bên trái ô nhập (icon tìm kiếm...). */
@Directive({ selector: '[fieldPrefix]', host: { class: 'app-field__prefix' } })
export class FieldPrefixDirective {}

/** Nội dung đặt bên phải ô nhập (đơn vị ₫, m³, nút xoá...). */
@Directive({ selector: '[fieldSuffix]', host: { class: 'app-field__suffix' } })
export class FieldSuffixDirective {}

/**
 * Khung trường nhập: nhãn ở trên, ô nhập, lỗi / gợi ý ở dưới.
 *
 * ```html
 * <app-field>
 *   <label fieldLabel>Tên phiếu</label>
 *   <input pInputText formControlName="title" />
 *   @if (form.controls.title.hasError('required')) { <app-error>Vui lòng nhập tên.</app-error> }
 *   <small fieldHint>Tối đa 200 ký tự</small>
 * </app-field>
 * ```
 *
 * Lỗi chỉ hiện sau khi control bị chạm (touched) – giống mat-form-field – và luôn chừa sẵn chỗ
 * dưới ô nhập để form không bị xô lệch khi lỗi xuất hiện (`dense` để bỏ khoảng chừa này).
 * Style nằm ở styles.scss (.app-field) vì phải áp lên nội dung được project vào.
 */
@Component({
  selector: 'app-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-field',
    '[class.app-field--dense]': 'dense()',
    '[class.app-field--invalid]': 'showError()',
    '[class.app-field--prefix]': '!!prefix()',
    '[class.app-field--suffix]': '!!suffix()',
  },
  template: `
    <ng-content select="[fieldLabel]" />
    <div class="app-field__control">
      <ng-content select="[fieldPrefix]" />
      <ng-content />
      <ng-content select="[fieldSuffix]" />
    </div>
    <div class="app-field__subscript" [attr.id]="messageId" aria-live="polite">
      @if (showError()) {
        <ng-content select="app-error" />
      } @else {
        <ng-content select="[fieldHint]" />
      }
    </div>
  `,
})
export class FieldComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly control = contentChild(NgControl, { descendants: true });
  protected readonly prefix = contentChild(FieldPrefixDirective);
  protected readonly suffix = contentChild(FieldSuffixDirective);

  /** Không chừa chỗ cho lỗi/gợi ý (thanh lọc, thanh công cụ). */
  readonly dense = input(false, { transform: booleanAttribute });

  protected readonly messageId = `app-field-msg-${++nextId}`;
  private readonly labelId = `app-field-label-${nextId}`;
  /** Tăng mỗi khi trạng thái control đổi (touched/status) để computed tính lại. */
  private readonly version = signal(0);

  protected readonly showError = computed(() => {
    this.version();
    const control = this.control()?.control;
    return !!control && control.invalid && control.touched;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.control()?.control;
      if (!control) {
        return;
      }
      const subscription = control.events.subscribe(() => this.version.update((value) => value + 1));
      onCleanup(() => subscription.unsubscribe());
    });

    // Gắn nhãn với ô nhập cho trình đọc màn hình (kể cả input nằm trong component PrimeNG).
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const label = root.querySelector<HTMLElement>('[fieldLabel]');
      const target = root.querySelector<HTMLElement>('.app-field__control input, .app-field__control textarea, .app-field__control [role="combobox"]');
      if (!label || !target) {
        return;
      }
      label.id ||= this.labelId;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.id ||= `${this.labelId}-control`;
        label.setAttribute('for', target.id);
      } else {
        target.setAttribute('aria-labelledby', label.id);
      }
      target.setAttribute('aria-describedby', this.messageId);
    });

    effect(() => {
      const invalid = this.showError();
      this.host.nativeElement.querySelector('.app-field__control input, .app-field__control textarea')?.setAttribute('aria-invalid', String(invalid));
    });
  }
}

/** Import một lần cho mọi phần của trường nhập. */
export const FIELD = [FieldComponent, FieldErrorComponent, FieldPrefixDirective, FieldSuffixDirective] as const;
