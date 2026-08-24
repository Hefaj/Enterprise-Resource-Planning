import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErpToastComponent, ErpToastService } from '@erp/shared/ui';

/**
 * Stos toastów aplikacji — jedyne miejsce, w którym kolejka z {@link ErpToastService}
 * zamienia się w piksele.
 *
 * <b>Dlaczego w hoście, a nie w `shared/ui` obok atomu.</b> Ten komponent wstrzykuje serwis,
 * a granice NX (`type:ui` → `{ui, util}`) nie pozwalają bibliotece `ui` zależeć od czegokolwiek
 * ze stanem aplikacji. Host jest warstwą, która może wszystko — i tak samo jak przy dzwonku
 * powiadomień, to on osadza cudzą zawartość we własnym layoucie.
 *
 * Siedzi w `app.html` wewnątrz `<tui-root>`, żeby dziedziczyć tokeny motywu TaigaUI.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [ErpToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toast of toasts(); track toast.id) {
      <erp-toast [config]="toast" (closed)="dismiss(toast.id)" />
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset-block-end: 1.5rem;
        inset-inline-end: 1.5rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
        /* Stos nie przechwytuje kliknięć — robią to pojedyncze toasty (patrz erp-toast). */
        pointer-events: none;
      }
    `,
  ],
})
export class ErpToastHostComponent {
  private readonly _toastService = inject(ErpToastService);

  protected readonly toasts = this._toastService.toasts;

  protected dismiss(id: string): void {
    this._toastService.dismiss(id);
  }
}
