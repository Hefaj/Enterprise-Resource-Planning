import { ChangeDetectionStrategy, Component, input, viewChild, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuModule } from 'primeng/contextmenu';
import { ErpContextMenuConfig } from './erp-context-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'erp-context-menu',
  standalone: true,
  imports: [CommonModule, ContextMenuModule],
  template: `
    @let _items = items();
    @let _global = isGlobal();
    
    <p-contextmenu
      #cm
      [model]="_items || []"
      [global]="_global || false"
      [appendTo]="'body'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpContextMenuComponent {
  private readonly _transloco = inject(TranslocoService);
  private readonly _lang = toSignal(this._transloco.langChanges$);

  public config = input.required<ErpContextMenuConfig>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public cm = viewChild<any>('cm');

  protected items = computed(() => {
    this._lang(); // track language change to trigger re-evaluation
    const rawItems = unwrapSignal(this.config().items) || [];
    return rawItems.map(item => ({
      ...item,
      label: item.label ? this._transloco.translate(item.label) : undefined
    }));
  });
  protected isGlobal = computed(() => unwrapSignal(this.config().global));

  public show(event: Event): void {
    this.cm()?.show(event);
  }

  public hide(): void {
    this.cm()?.hide();
  }
}
