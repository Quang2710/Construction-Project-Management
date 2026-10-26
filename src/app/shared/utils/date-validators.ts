import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Ngày không được sau `max` (so theo ngày, bỏ giờ). Lỗi: { maxDate: true }. */
export function maxDateValidator(max: Date): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    return value instanceof Date && startOfDay(value) > startOfDay(max) ? { maxDate: true } : null;
  };
}

/** Ngày không được trước `min` (so theo ngày, bỏ giờ). Lỗi: { minDate: true }. */
export function minDateValidator(min: Date): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    return value instanceof Date && startOfDay(value) < startOfDay(min) ? { minDate: true } : null;
  };
}
