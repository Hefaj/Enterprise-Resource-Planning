import { ChangeDetectionStrategy, Component, input, signal, computed } from '@angular/core';
import { TuiDrawer } from '@taiga-ui/kit';
import { TuiPopup } from '@taiga-ui/core';
import { ErpDrawerConfig } from './erp-drawer.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-drawer',
  standalone: true,
  imports: [TuiDrawer, TuiPopup],
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
      <div class="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
        <span class="font-bold text-slate-700 dark:text-slate-200">{{ _header || 'Menu' }}</span>
        <button
          class="border-0 bg-transparent cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center text-slate-500"
          (click)="hide()"
        >
          <i class="pi pi-times"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4 px-6">
        <ng-content />
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
        <small class="text-slate-400">{{ _footer || 'v1.0.0 (v21.0.0)' }}</small>
      </div>
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
