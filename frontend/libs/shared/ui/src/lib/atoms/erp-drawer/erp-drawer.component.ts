import { ChangeDetectionStrategy, Component, input, signal, computed } from '@angular/core';
import { TuiDrawer } from '@taiga-ui/kit';
import { TuiPopup } from '@taiga-ui/core';
import { ErpButtonComponent, ErpButtonBuilder } from '../erp-button';
import { ERP_ICONS } from '../../base/erp-icon.types';
import { ErpDrawerConfig } from './erp-drawer.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-drawer',
  standalone: true,
  imports: [TuiDrawer, TuiPopup, ErpButtonComponent],
  template: `
    @let _header = configHeader();
    @let _footer = configFooter();
    @let _styleClass = styleClass();

    <tui-drawer
      *tuiPopup="visible()"
      [overlay]="true"
      direction="start"
      [class]="_styleClass || '!w-80 border-r border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-zinc-900 h-full flex flex-col'"
      (click.self)="hide()"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <span class="text-lg font-semibold text-slate-900 dark:text-white">{{ _header || 'Menu' }}</span>
        <erp-button [config]="closeBtnConfig()" />
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden">
        <ng-content />
      </div>

      <!-- Footer -->
      @if (_footer) {
        <div class="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 shrink-0">
          <small class="text-slate-400">{{ _footer }}</small>
        </div>
      }
    </tui-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDrawerComponent {
  public config = input<ErpDrawerConfig>({});
  
  protected readonly visible = signal(false);

  protected configHeader = computed(() => unwrapSignal(this.config().header));
  protected configFooter = computed(() => unwrapSignal(this.config().footer));
  protected styleClass = computed(() => unwrapSignal(this.config().styleClass));

  protected closeBtnConfig = computed(() =>
    ErpButtonBuilder.create((b) =>
      b
        .setIconStart(ERP_ICONS.x)
        .setAppearance('glass')
        .setSize('s')
        .setOnClick(() => this.hide())
    )
  );

  public toggle(): void {
    this.visible.update((v) => !v);
  }

  public show(): void {
    this.visible.set(true);
  }

  public hide(): void {
    this.visible.set(false);
  }
}
