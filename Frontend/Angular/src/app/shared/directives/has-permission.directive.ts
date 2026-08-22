import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Structural directive – shows element only when user has the specified permission.
 *
 * Usage:
 *   <button *hasPermission="'departments.create'">Add</button>
 *   <div *hasPermission="['roles.read', 'roles.write']; mode: 'any'">...</div>
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly tmpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly permissionSvc = inject(PermissionService);

  @Input() set hasPermission(permissions: string | string[]) {
    this._permissions = Array.isArray(permissions) ? permissions : [permissions];
    this._update();
  }

  @Input() set hasPermissionMode(mode: 'any' | 'all') {
    this._mode = mode;
    this._update();
  }

  private _permissions: string[] = [];
  private _mode: 'any' | 'all' = 'any';

  private _update(): void {
    const allowed =
      this._mode === 'all'
        ? this.permissionSvc.canAll(this._permissions)
        : this.permissionSvc.canAny(this._permissions);

    this.vcr.clear();
    if (allowed) {
      this.vcr.createEmbeddedView(this.tmpl);
    }
  }
}
