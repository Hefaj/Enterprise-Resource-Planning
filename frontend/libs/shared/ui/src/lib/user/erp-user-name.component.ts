import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ERP_USER_DIRECTORY } from '@erp/shared/util';

/**
 * Nazwisko zamiast uuidu — wszędzie, gdzie backend oddaje sam identyfikator osoby.
 *
 * <p><b>Komponent, nie pipe</b>, bo pipe musiałby wołać serwis w każdym cyklu detekcji albo
 * być nieczysty; tutaj sygnał z katalogu przerysowuje wyłącznie ten jeden element, kiedy
 * paczka nazwisk dojedzie.</p>
 *
 * <p><b>Fallback jest częścią kontraktu.</b> Dopóki nazwisko nie dojedzie — i na zawsze, gdy
 * katalog tej osoby nie zna (konto skasowane w Keycloaku, dane z importu) — pokazuje się
 * skrócony uuid. Pusty element w tym miejscu wyglądałby jak brak przypisania, a to zupełnie
 * inna informacja niż „nie wiem, kto to”.</p>
 *
 * ```html
 * <erp-user-name [uuid]="issue.assigneeUuid" [fallback]="ISSUE_KEYS.table.unassigned" />
 * ```
 */
@Component({
  selector: 'erp-user-name',
  standalone: true,
  template: `
    @let user = this.user();

    @if (user) {
      <span [class.erp-user-name--inactive]="!user.isActive" [attr.title]="user.email">
        {{ user.displayName }}
      </span>
    } @else {
      <span class="erp-user-name--unresolved" [attr.title]="uuid()">{{ placeholder() }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline;
      }

      .erp-user-name--inactive {
        text-decoration: line-through;
        color: var(--tui-text-secondary);
      }

      .erp-user-name--unresolved {
        color: var(--tui-text-secondary);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserNameComponent {
  /** Identyfikator osoby (claim `sub` z Keycloaka). `null` znaczy „nikt”. */
  public readonly uuid = input<string | null | undefined>(null);

  /**
   * Co pokazać, gdy `uuid` jest pusty — <b>gotowy tekst</b>, nie klucz tłumaczenia: ten
   * komponent nie zna scope’u modułu, który go renderuje. Wywołujący przepuszcza swój klucz
   * przez `erpTranslate` i podaje wynik.
   */
  public readonly empty = input<string>('—');

  /** Opcjonalnie: bez katalogu komponent pokazuje skrócony uuid zamiast wywracać ekran. */
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

  protected readonly user = computed(() => this._directory?.getOne(this.uuid())());

  /** Skrócony uuid — pełny zostaje w `title`, żeby dało się go skopiować przy zgłaszaniu błędu. */
  protected readonly placeholder = computed(() => {
    const uuid = this.uuid();

    if (!uuid) {
      return this.empty();
    }

    return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
  });
}
