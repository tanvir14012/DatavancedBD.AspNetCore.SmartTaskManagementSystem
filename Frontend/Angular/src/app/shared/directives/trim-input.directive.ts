import { Directive, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Trims whitespace from text input on blur.
 * Usage: <input trimInput formControlName="name">
 */
@Directive({
  selector: 'input[trimInput], textarea[trimInput]',
  standalone: true,
})
export class TrimInputDirective {
  private readonly control = inject(NgControl, { optional: true });

  @HostListener('blur')
  onBlur(): void {
    const ctrl = this.control?.control;
    if (ctrl && typeof ctrl.value === 'string') {
      ctrl.setValue(ctrl.value.trim(), { emitEvent: false });
    }
  }
}
