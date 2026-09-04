import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TuiAppearance, TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';

import { ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';

import { ErpTagChipItem, ErpTagChipsConfig } from './erp-tag-chips.types';

/**
 * Chipsy — dziś typ i priorytet, przygotowane pod tagi z fazy 6
 * (`docs/modules/task-management/screens.md` §10). Prezentacyjny: lista przychodzi gotowa,
 * usuwanie tylko emituje `remove`, nie woła żadnej komendy samo.
 */
@Component({
  selector: 'erp-tag-chips',
  standalone: true,
  imports: [TuiAppearance, TuiChip, TuiIcon, ErpTranslatePipe],
  template: `
    <div class="erp-tag-chips">
      @for (item of this.items(); track item.value) {
        <span tuiChip [size]="this.size()" [tuiAppearance]="this.appearance(item)">
          @if (item.icon) {
            <tui-icon [icon]="item.icon" />
          }
          {{ item.translate === false ? item.label : (item.label | erpTranslate) }}
          @if (this.removable()) {
            <button type="button" class="erp-tag-chips__remove" (click)="this.remove.emit(item.value)">×</button>
          }
        </span>
      }
    </div>
  `,
  styles: [
    `
      .erp-tag-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }

      .erp-tag-chips__remove {
        margin-left: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        color: inherit;
        line-height: 1;
        padding: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTagChipsComponent {
  public readonly config = input.required<ErpTagChipsConfig>();

  /** Emituje `value` chipa, który użytkownik chce usunąć — wywołujący decyduje, co z tym zrobić. */
  public readonly remove = output<string>();

  protected readonly items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected readonly size = computed(() => unwrapSignal(this.config().size) ?? 'xs');
  protected readonly removable = computed(() => unwrapSignal(this.config().removable) ?? false);

  protected appearance(item: ErpTagChipItem): string {
    switch (item.appearance) {
      case 'negative':
        return 'negative';
      case 'warning':
        return 'warning';
      case 'positive':
        return 'positive';
      case 'info':
        return 'info';
      default:
        return 'neutral';
    }
  }
}
