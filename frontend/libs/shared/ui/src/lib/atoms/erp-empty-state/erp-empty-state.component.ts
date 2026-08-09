import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpEmptyStateConfig } from './erp-empty-state.types';

/**
 * ErpEmptyState — wyśrodkowany komunikat "pusto" (ikona + tekst), używany jako
 * alternatywny widok, gdy dana treść (tabela, panel) nie ma jeszcze nic do pokazania,
 * np. przed dokonaniem wyboru przez użytkownika. Ten sam wygląd co stan pusty w `erp-group-panel`.
 */
@Component({
  selector: 'erp-empty-state',
  standalone: true,
  imports: [TuiIcon, ErpTranslatePipe],
  template: `
    <div class="erp-empty-state">
      @if (_icon()) {
        <tui-icon [icon]="_icon()!" class="erp-empty-state__icon" />
      }
      <p>{{ (_message() | erpTranslate) || '' }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .erp-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      height: 100%;
      text-align: center;
      padding: 2rem;
      color: var(--tui-text-secondary);
    }

    .erp-empty-state__icon {
      font-size: 3rem;
    }

    .erp-empty-state p {
      margin: 0;
      line-height: 1.5;
      max-width: 32rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpEmptyStateComponent {
  public readonly config = input.required<ErpEmptyStateConfig>();

  protected readonly _icon = computed(() => unwrapSignal(this.config().icon));
  protected readonly _message = computed(() => unwrapSignal(this.config().message));
}
