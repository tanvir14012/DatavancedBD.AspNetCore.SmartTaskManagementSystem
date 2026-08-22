import { FormBuilder as NgFormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Injectable } from '@angular/core';

/**
 * Enhanced form builder
 */
@Injectable({ providedIn: 'root' })
export class FormBuilder {
  constructor(private fb: NgFormBuilder) {}

  createForm(config: Record<string, any>): FormGroup {
    const group: Record<string, FormControl> = {};

    for (const [key, value] of Object.entries(config)) {
      group[key] = new FormControl(value);
    }

    return this.fb.group(group);
  }

  createDynamicForm(controls: Record<string, any[]>): FormGroup {
    return this.fb.group(controls);
  }
}
