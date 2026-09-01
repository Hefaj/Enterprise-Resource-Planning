import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ERP_USER_DIRECTORY } from '@erp/shared/util';

/** Paleta kółek awatara — deterministyczna po uuid, żeby ta sama osoba miała ten sam kolor
 * na całej karcie (komentarz, strumień aktywności, pole „przypisany"), a nie losowy przy
 * każdym renderze. Wartości to `--tui-*` tokeny statusów, więc paleta sama przełącza się
 * z motywem. */
const AVATAR_TONES = [
  'var(--tui-status-info)',
  'var(--tui-status-positive)',
  'var(--tui-status-warning)',
  'var(--tui-status-negative)',
  'var(--tui-status-neutral)',
] as const;

/**
 * Kółko z inicjałami zamiast zdjęcia — katalog użytkowników nie niesie awatara (Keycloak go
 * nie oddaje), więc jedyny nietrywialny sposób odróżnienia osób na liście jest kolorem,
 * nie fotografią.
 *
 * ```html
 * <erp-user-avatar [uuid]="comment.authorUuid" />
 * ```
 */
@Component({
  selector: 'erp-user-avatar',
  standalone: true,
  template: `
    @let user = this.user();

    <span
      class="erp-user-avatar"
      [class.erp-user-avatar--s]="this.size() === 's'"
      [style.background]="this.tone()"
      [attr.title]="user?.displayName ?? this.uuid()"
    >
      {{ this.initials() }}
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .erp-user-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 999px;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--tui-text-primary-on-accent-1, #fff);
        flex-shrink: 0;
        user-select: none;
      }

      .erp-user-avatar--s {
        width: 1.375rem;
        height: 1.375rem;
        font-size: 0.5625rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserAvatarComponent {
  /** Identyfikator osoby (claim `sub` z Keycloaka). `null` renderuje „?" w neutralnym kolorze. */
  public readonly uuid = input<string | null | undefined>(null);

  public readonly size = input<'s' | 'm'>('m');

  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

  /** Bez uuid nie ma po co pytać katalogu — `getOne(undefined)` i tak nie ma czego cache’ować
   * i oddaje świeży sygnał przy każdym wywołaniu (`UserDirectoryService.getOne`), więc bez tej
   * bramki komputed wołałby katalog na pusto przy każdym przeliczeniu. */
  protected readonly user = computed(() => {
    const uuid = this.uuid();
    return uuid ? this._directory?.getOne(uuid)() : undefined;
  });

  protected readonly initials = computed(() => {
    const name = this.user()?.displayName;

    if (!name) {
      return '?';
    }

    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

    return (first + last).toUpperCase();
  });

  protected readonly tone = computed(() => {
    const uuid = this.uuid();

    if (!uuid) {
      return 'var(--tui-background-neutral-2)';
    }

    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      hash = (hash * 31 + uuid.charCodeAt(i)) >>> 0;
    }

    return AVATAR_TONES[hash % AVATAR_TONES.length];
  });
}
