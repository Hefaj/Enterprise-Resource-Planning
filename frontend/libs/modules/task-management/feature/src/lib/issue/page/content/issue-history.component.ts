import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';

import { ErpTranslatePipe } from '@erp/shared/ui';
import { IssueActivityDto, IssueActivityService } from '@erp/task-management/data-access';
import { ISSUE_ACTIVITY_KIND } from '@erp/task-management/util';

import { ISSUE_KEYS } from '../../translation';

/**
 * Wpis historii gotowy do wyświetlenia.
 *
 * <p>Zdanie zostaje <b>rozłożone na klucz i parametry</b>, zamiast być składane w TS na gotowy
 * tekst: nazwa pola sama jest kluczem tłumaczenia, więc musi przejść przez `erpTranslate`
 * ZANIM trafi jako parametr do zdania. Transloco nie rozwiązuje kluczy zagnieżdżonych
 * w parametrach — złożenie w kodzie dałoby w interfejsie `issue.detail.history.fields.title`
 * zamiast słowa „tytuł”.</p>
 */
interface IssueHistoryRow {
  readonly uuid: string;
  readonly actorUuid: string;
  readonly occurredAt: Date;

  /** Klucz zdania „co zrobił”. */
  readonly sentenceKey: string;

  /** Klucz nazwy pola albo jego surowy kod — tylko dla zmian pól. */
  readonly fieldKey?: string;

  readonly from?: string;
  readonly to?: string;

  /** Wartość wstawiana wprost (klucz zgłoszenia, nazwa pliku) — nie jest kluczem tłumaczenia. */
  readonly value?: string;
}

/**
 * Historia zmian zgłoszenia — najnowsze pierwsze.
 *
 * <p><b>Zdanie składa się tutaj, z kluczy tłumaczeń.</b> Backend zapisuje rodzaj wpisu, kod pola
 * i surowe wartości; gotowego tekstu nie ma tam w żadnym języku i być nie może — historia jest
 * czytana po latach, także przez kogoś z innym ustawieniem języka niż autor zmiany
 * (`docs/backend/task-management.md` §11).</p>
 *
 * <p><b>Wartości pokazujemy tak, jak przyszły.</b> Uuid przypisanego nie zamienia się tu na
 * nazwisko, a uuid stanu na nazwę: jedno i drugie wymagałoby dociągnięcia słowników, których
 * karta może już nie mieć (stan skasowany ze schematu, użytkownik usunięty). Rozwiązanie tego
 * wchodzi razem z katalogiem użytkowników na froncie — dziś nie ma go w żadnym module.</p>
 */
@Component({
  selector: 'erp-task-management-issue-history',
  standalone: true,
  imports: [DatePipe, ErpTranslatePipe],
  template: `
    <section class="flex flex-col gap-2">
      <h2 class="m-0 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
        {{ ISSUE_KEYS.detail.history.label | erpTranslate }}
      </h2>

      @if (rows().length === 0) {
        <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
          {{ ISSUE_KEYS.detail.history.empty | erpTranslate }}
        </p>
      } @else {
        <ol class="m-0 flex list-none flex-col gap-1 p-0">
          @for (row of rows(); track row.uuid) {
            <li class="flex flex-wrap items-baseline gap-2 text-sm">
              <span class="text-xs text-[var(--tui-text-secondary)]">
                {{ row.occurredAt | date: 'short' }}
              </span>
              <span class="font-medium">{{ row.actorUuid }}</span>
              @if (row.fieldKey) {
                <span>
                  {{
                    row.sentenceKey
                      | erpTranslate: { field: row.fieldKey | erpTranslate, from: row.from, to: row.to }
                  }}
                </span>
              } @else {
                <span>{{ row.sentenceKey | erpTranslate: { value: row.value } }}</span>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueHistoryComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  /** Zgłoszenie, którego historię pokazuje sekcja. */
  public readonly issueUuid = input.required<string | null>();

  private readonly _activity = inject(IssueActivityService);

  protected readonly rows = computed<IssueHistoryRow[]>(() =>
    this._activity.entriesOf(this.issueUuid())().map((entry) => ({
      uuid: entry.uuid,
      actorUuid: entry.actorUuid,
      occurredAt: entry.occurredAt,
      ...sentenceOf(entry),
    })),
  );

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();
      untracked(() => {
        if (uuid) {
          void this._activity.loadAsync(uuid);
        }
      });
    });
  }
}

/** Klucze nazw pól — kod pola jest techniczny (`due_at`), klucz rejestru nie. */
const FIELD_KEYS: Record<string, string> = {
  title: ISSUE_KEYS.detail.history.fields.title,
  description: ISSUE_KEYS.detail.history.fields.description,
  priority: ISSUE_KEYS.detail.history.fields.priority,
  assignee: ISSUE_KEYS.detail.history.fields.assignee,
  due_at: ISSUE_KEYS.detail.history.fields.dueAt,
  state: ISSUE_KEYS.detail.history.fields.state,
};

/**
 * Zamienia wpis na zdanie z parametrami interpolacji.
 *
 * Pole nieznane rejestrowi (dojdzie z polami niestandardowymi w fazie 3) pokazuje własny kod —
 * to jedyne dopuszczone wyjście poza registry, dokładnie jak przy nazwach stanów
 * (`docs/frontend/task-management-pages.md` §8).
 */
function sentenceOf(entry: IssueActivityDto): Omit<IssueHistoryRow, 'uuid' | 'actorUuid' | 'occurredAt'> {
  const keys = ISSUE_KEYS.detail.history;

  switch (entry.kind) {
    case ISSUE_ACTIVITY_KIND.Created:
      return { sentenceKey: keys.kind.created, value: entry.newValue ?? '' };

    case ISSUE_ACTIVITY_KIND.StateChanged:
      return { sentenceKey: keys.kind.stateChanged };

    case ISSUE_ACTIVITY_KIND.CommentAdded:
      return { sentenceKey: keys.kind.commentAdded };

    case ISSUE_ACTIVITY_KIND.CommentRemoved:
      return { sentenceKey: keys.kind.commentRemoved };

    case ISSUE_ACTIVITY_KIND.AttachmentAdded:
      return { sentenceKey: keys.kind.attachmentAdded, value: entry.newValue ?? '' };

    default: {
      const fieldKey = entry.fieldCode ? (FIELD_KEYS[entry.fieldCode] ?? entry.fieldCode) : '';

      // Wpis bez wartości to zmiana pola zbyt obszernego, żeby je kopiować do historii
      // (opis) — zdanie mówi wtedy samo „zmienił opis”, bez „z czego na co”.
      if (!entry.oldValue && !entry.newValue) {
        return { sentenceKey: keys.kind.fieldChanged, fieldKey };
      }

      return {
        sentenceKey: keys.kind.fieldChangedWithValues,
        fieldKey,
        from: entry.oldValue ?? '—',
        to: entry.newValue ?? '—',
      };
    }
  }
}
