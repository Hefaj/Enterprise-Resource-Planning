import { Signal, computed, effect, signal, untracked } from '@angular/core';
import {
  ErpBatchTargets,
  ErpSelectionScope,
  erpBuildBatchTargets,
  erpSelectionScopeCount,
} from '../atoms/erp-table/erp-selection.utils';

/**
 * Domyślnie: ilu rodziców pokazuje panel boczny, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const ERP_SCOPE_PREVIEW_LIMIT = 10;

/** Wiring, którym strona podłącza swój zasięg i orkiestrator do wspólnej mechaniki panelu. */
export interface ErpScopeTabSource<TParent, TFilter> {
  /** Zasięg zaznaczenia strony (`XStore.scope`) — jedyne źródło prawdy o celu operacji. */
  readonly scope: Signal<ErpSelectionScope<TParent, TFilter>>;

  /**
   * Zwraca aktualny model widoku rodzica po UUID (zwykle `orchestrator.getOne(uuid)()` albo
   * odczyt z `getSignalViewModel()`). Dzięki temu wiersze panelu aktualizują się z SignalR,
   * a zaznaczenie zmaterializowane — które nie niesie ze sobą pozycji — działa jak ręczne.
   */
  readonly parentById: (uuid: string) => TParent | undefined;

  /**
   * Rozwiązuje pierwsze `limit` identyfikatorów pasujących do filtra — próbka dla trybu `query`.
   * Strony z tabelą klieńcką (cały zbiór w pamięci, zasięg nigdy nie jest `query`) tego nie
   * podają; wtedy panel nigdy nie prosi o próbkę.
   */
  readonly resolveUuids?: (filter: Partial<TFilter>, limit: number) => Promise<string[]>;

  /** Ilu rodziców pokazuje próbka w trybie `query`. */
  readonly previewLimit?: number;
}

/**
 * Wspólna podstawa **każdej** zakładki panelu bocznego zależnej od zaznaczenia — niezależnie od
 * modułu i agregatu. Panel pokazuje JEDNĄ tabelę zbierającą wiersze podrzędne WSZYSTKICH
 * zaznaczonych rodziców (multimedia wszystkich zaznaczonych produktów, role wszystkich
 * zaznaczonych użytkowników…), pogrupowaną po rodzicu — patrz `docs/frontend/pages.md` §6.
 *
 * Zbiera w jednym miejscu obsługę „Zaznacz wszystko" opisaną w
 * `docs/frontend/selection-scope.md`, żeby żadna zakładka nie odtwarzała jej po swojemu
 * (a najczęściej — nie pomijała, czytając `selection().selectedItems` wprost i pokazując pusty
 * ekran przy tysiącach zaznaczonych pozycji):
 *
 * - zasięg (`scope`) zamiast surowego zaznaczenia,
 * - próbka rodziców w trybie `query`,
 * - blokada granularnego wyboru tam, gdzie panel pokazuje tylko próbkę,
 * - modele widoku brane po UUID z orkiestratora,
 * - unieważnianie podzaznaczenia przy zmianie zbioru rodziców.
 *
 * `TChild` to typ wiersza podrzędnego zakładki (plik multimediów, przypisanie roli…) — store
 * trzyma zaznaczone wiersze w oryginalnej postaci, a zakładka wyprowadza z nich to, czego
 * potrzebuje jej akcja (`computed`).
 *
 * Klasa jest celowo NIEudekorowana — dziedziczą po niej store'y zakładek oznaczone
 * `@Injectable()` i rejestrowane na poziomie komponentu zakładki.
 */
export abstract class ErpScopeTabStore<TParent, TFilter = unknown, TChild = unknown> {
  private readonly source: ErpScopeTabSource<TParent, TFilter>;
  private readonly previewLimit: number;

  /** Zasięg zaznaczenia rodziców — to on rozstrzyga, co panel może pokazać i pozwolić zrobić. */
  public readonly scope: Signal<ErpSelectionScope<TParent, TFilter>>;
  public readonly scopeKind: Signal<ErpSelectionScope<TParent, TFilter>['kind']>;

  /** Liczność zasięgu — w trybie `query` to szacunek z licznika wyników. */
  public readonly scopeCount: Signal<number>;

  /** Czy zaznaczenie powstało z „Zaznacz wszystko" rozwiązanego do listy identyfikatorów. */
  public readonly isMaterialized: Signal<boolean>;

  /** Czy trwa rozwiązywanie zaznaczenia „wszystko" do listy identyfikatorów. */
  public readonly resolving: Signal<boolean>;

  /**
   * Czy wolno wybierać pojedyncze wiersze podrzędne. Przy zaznaczeniu opisanym filtrem — nie:
   * checkbox obiecuje „operacja obejmie dokładnie to", a przy próbce z tysięcy rodziców to
   * nieprawda. Tak samo zachowuje się tabela główna, która przy „Zaznacz wszystko" blokuje
   * checkboxy wierszy.
   */
  public readonly canSelectChildren: Signal<boolean>;

  private readonly _previewUuids = signal<string[]>([]);

  /** UUID rodziców, których zakładka faktycznie renderuje (komplet albo próbka). */
  public readonly visibleParentUuids: Signal<string[]>;

  /** Rodzice renderowani przez zakładkę — grupy jednej wspólnej tabeli wierszy podrzędnych. */
  public readonly parents: Signal<TParent[]>;

  /** Ilu rodziców widać w panelu — liczba do zdania o zasięgu („Podgląd X z Y"). */
  public readonly shownParentCount: Signal<number>;

  /** Podzaznaczenie wierszy zakładki — w postaci, w jakiej dała je tabela. */
  public readonly selectedChildren = signal<readonly TChild[]>([]);

  public readonly selectedChildrenCount = computed<number>(() => this.selectedChildren().length);

  protected constructor(source: ErpScopeTabSource<TParent, TFilter>) {
    this.source = source;
    this.previewLimit = source.previewLimit ?? ERP_SCOPE_PREVIEW_LIMIT;

    this.scope = source.scope;
    this.scopeKind = computed(() => this.scope().kind);
    this.scopeCount = computed(() => erpSelectionScopeCount(this.scope()));

    this.isMaterialized = computed(() => {
      const scope = this.scope();
      return scope.kind === 'explicit' && scope.materialized;
    });

    this.resolving = computed(() => {
      const scope = this.scope();
      return scope.kind === 'explicit' && scope.loading;
    });

    this.canSelectChildren = computed(() => {
      const scope = this.scope();
      return scope.kind === 'explicit' && !scope.loading;
    });

    this.visibleParentUuids = computed(() => {
      const scope = this.scope();
      if (scope.kind === 'explicit') return scope.ids;
      if (scope.kind === 'query') return this._previewUuids();
      return [];
    });

    this.parents = computed(() => {
      const uuids = this.visibleParentUuids();
      if (uuids.length === 0) return [];

      const scope = this.scope();
      const known = scope.kind === 'explicit' ? scope.items : [];

      return uuids
        .map((uuid, index) => this.source.parentById(uuid) ?? known[index])
        .filter((vm): vm is TParent => vm !== undefined && vm !== null);
    });

    this.shownParentCount = computed(() => this.parents().length);

    // Podgląd dla trybu filtra — kilku pierwszych rodziców pasujących do zaznaczenia.
    effect(() => {
      const scope = this.scope();
      const resolveUuids = this.source.resolveUuids;
      if (scope.kind !== 'query' || !resolveUuids) {
        untracked(() => this._previewUuids.set([]));
        return;
      }

      untracked(() => {
        void resolveUuids(scope.filter, this.previewLimit).then((uuids) => {
          // Zaznaczenie mogło się zmienić w trakcie żądania — nieaktualnej próbki nie pokazujemy.
          if (this.scope().kind === 'query') {
            this._previewUuids.set(uuids);
          }
        });
      });
    });

    // Zmiana zbioru rodziców unieważnia podzaznaczenie — inaczej akcja „usuń zaznaczone"
    // zadziałałaby na wiersze rodzica, którego już nie ma w panelu.
    effect(() => {
      this.visibleParentUuids();
      untracked(() => {
        if (this.selectedChildren().length > 0) {
          this.selectedChildren.set([]);
        }
      });
    });
  }

  public setSelectedChildren(items: readonly TChild[]): void {
    this.selectedChildren.set(items);
  }

  public clearChildSelection(): void {
    this.selectedChildren.set([]);
  }

  /**
   * Cele operacji masowej dla bieżącego zasięgu. Zakładki NIE składają
   * `targetUuids`/`targetFilter` ręcznie — reguła „uuidy czy filtr" żyje w jednym miejscu.
   */
  public batchTargets(): ErpBatchTargets<TFilter> {
    return erpBuildBatchTargets<TFilter>(this.scope() as ErpSelectionScope<unknown, TFilter>);
  }
}
