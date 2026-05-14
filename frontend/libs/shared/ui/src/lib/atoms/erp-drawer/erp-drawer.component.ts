import { ChangeDetectionStrategy, Component, input, signal, computed } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ErpDrawerConfig } from './erp-drawer.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-drawer',
  standalone: true,
  imports: [DrawerModule],
  template: `
    @let _header = configHeader();
    @let _footer = configFooter();
    @let _styleClass = styleClass();

    <p-drawer
      [(visible)]="visible"
      [closable]="false"
      [styleClass]="_styleClass || '!w-80 border-r border-slate-200 dark:border-slate-800 shadow-2xl'"
    >
      <ng-template #header>
        <span class="font-bold text-slate-700 dark:text-slate-200">{{ _header || 'Menu' }}</span>
      </ng-template>

      <div class="py-4">
        <ng-content />
      </div>

      <ng-template #footer>
        <small class="text-slate-400">{{ _footer || 'v1.0.0 (v21.0.0)' }}</small>
      </ng-template>
    </p-drawer>
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
