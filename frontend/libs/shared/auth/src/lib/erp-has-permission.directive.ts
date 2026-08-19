import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionStore } from './permission.store';

/**
 * Dyrektywa strukturalna — renderuje zawartość tylko, gdy bieżący użytkownik ma podany kod
 * uprawnienia. Wzorzec analogiczny do `*ngIf`, bo w repo nie ma jeszcze innej dyrektywy
 * strukturalnej do naśladowania. Front tylko chowa UI (patrz `PermissionStore`) — nie jest
 * to zabezpieczenie, tylko dopasowanie tego, co widać, do tego, na co backend i tak
 * pozwoli.
 *
 * @example
 * <section *erpHasPermission="ERP_PERMISSIONS.Identity.RoleManage">...</section>
 */
@Directive({
  selector: '[erpHasPermission]',
  standalone: true,
})
export class ErpHasPermissionDirective {
  private readonly _templateRef = inject(TemplateRef<unknown>);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _permissionStore = inject(PermissionStore);

  public readonly erpHasPermission = input.required<string>();

  private _hasView = false;

  public constructor() {
    effect(() => {
      const has = this._permissionStore.has(this.erpHasPermission());

      if (has && !this._hasView) {
        this._viewContainerRef.createEmbeddedView(this._templateRef);
        this._hasView = true;
      } else if (!has && this._hasView) {
        this._viewContainerRef.clear();
        this._hasView = false;
      }
    });
  }
}
