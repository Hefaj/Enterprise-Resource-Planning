import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  IssueVM,
  ProjectWorkflowService,
  SearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import {
  ErpSelectionScope,
  ErpSelectionState,
  erpResolveSelectionScope,
  erpSelectionCount,
} from '@erp/shared/ui';

/**
 * Do ilu zgłoszeń „Zaznacz wszystko" jest jeszcze rozwiązywane do listy identyfikatorów —
 * ten sam próg co w Catalogu i Identity, patrz `docs/frontend/selection-scope.md` §2.
 */
export const ISSUE_SELECTION_MATERIALIZE_LIMIT = 100;

/**
 * Stan strony `/task-management/issue` — filtry, zaznaczenie i zasięg akcji masowych.
 *
 * <p><b>Kontekst projektu jest tutaj, nie w filtrze.</b> Zmiana projektu <b>resetuje sortowanie
 * i filtry projekto-specyficzne</b>: whitelist sortowania po stronie backendu to kolumny wspólne
 * `issue` plus sloty aktywnego projektu, więc pole z poprzedniego kontekstu zostałoby po cichu
 * zignorowane, a użytkownik widziałby kolejność, o którą nie prosił
 * (`docs/frontend/task-management-pages.md` §2.1). Sloty wchodzą w fazie 3 — reset jest już
 * teraz, bo dopisanie go później oznacza znalezienie tego błędu w produkcji.</p>
 */
@Injectable()
export class IssueStore {
  private readonly _orchestrator = inject(TaskManagementIssueOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);

  public readonly filters = signal<Partial<SearchIssueRequest>>({});
  public readonly loading = signal<boolean>(false);
  public readonly sorts = signal<SearchIssueRequest['sorts']>(undefined);

  /** Projekt zawężający listę; `null` = wszystkie dostępne. Odblokowuje kolumny i filtry
   * projekto-specyficzne (faza 3) oraz filtr stanu, bo stany pochodzą ze schematu projektu. */
  public readonly projectUuid = computed<string | null>(() => this.filters().projectUuid ?? null);

  /** Stany aktywnego projektu — źródło opcji filtra stanu. Pusta lista, dopóki schemat
   * nie dojedzie albo dopóki nie wybrano projektu. */
  public readonly states = computed(() => this._workflow.statesOf(this.projectUuid())());

  public updateFilters(partial: Partial<SearchIssueRequest>): void {
    this._uuidCache.clear();

    this.filters.update((current) => {
      const next = { ...current, ...partial };

      if (partial.projectUuid !== undefined && partial.projectUuid !== current.projectUuid) {
        // Nowy kontekst projektu — stan i sortowanie z poprzedniego nie mają tu odpowiednika.
        delete next.stateUuid;
        this.sorts.set(undefined);
      }

      return next;
    });
  }

  public setSorts(sorts: SearchIssueRequest['sorts']): void {
    this.sorts.set(sorts);
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  public constructor() {
    // Schemat stanów wybranego projektu — bez niego filtr stanu nie ma z czego zbudować opcji,
    // a karta nie wie, dokąd wolno przenieść zgłoszenie.
    effect(() => {
      const projectUuid = this.projectUuid();
      if (projectUuid) {
        untracked(() => void this._workflow.loadAsync(projectUuid));
      }
    });

    // Materializacja małych zaznaczeń „wszystko" — wzorzec identyczny jak w `ProductStore`.
    effect(() => {
      const selection = this.selection();
      if (!selection?.isAllSelected) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const count = erpSelectionCount(selection);
      if (count === 0 || count > ISSUE_SELECTION_MATERIALIZE_LIMIT) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const token = this._filterToken(selection.filters);
      untracked(() => {
        if (this._materialized()?.token === token) return;
        void this._materialize(token, selection.filters ?? {}, count);
      });
    });
  }

  // ── Zaznaczenie i zasięg — patrz docs/frontend/selection-scope.md §2 ──

  public readonly selection = signal<ErpSelectionState<IssueVM> | null>(null);

  public setSelection(state: ErpSelectionState<IssueVM>): void {
    this.selection.set(state);
  }

  public clearSelection(): void {
    this._materialized.set(null);
    this.selection.set({ mode: 'server', isAllSelected: false, selectedItems: [], selectedIds: [] });
  }

  private readonly _materialized = signal<{ token: string; uuids: string[] } | null>(null);
  private readonly _uuidCache = new Map<string, string[]>();

  public readonly scope = computed<ErpSelectionScope<IssueVM, SearchIssueRequest>>(() => {
    const selection = this.selection();
    const materialized = this._materialized();
    const token = this._filterToken(selection?.filters);

    return erpResolveSelectionScope<IssueVM, SearchIssueRequest>(selection, {
      materializeLimit: ISSUE_SELECTION_MATERIALIZE_LIMIT,
      materializedIds: materialized?.token === token ? materialized.uuids : null,
    });
  });

  public readonly scopeKind = computed(() => this.scope().kind);

  /** Pierwsze `limit` identyfikatorów pasujących do filtra — dla materializacji zaznaczenia. */
  public async resolveUuids(filters: Partial<SearchIssueRequest>, limit: number): Promise<string[]> {
    const key = `${this._filterToken(filters)}|${limit}`;
    const cached = this._uuidCache.get(key);
    if (cached) return cached;

    const response = await this._orchestrator.searchAsync(
      { ...filters, page: 1, pageSize: limit } as SearchIssueRequest,
      { autoLoad: true },
    );

    const uuids = response.uuids ?? [];
    this._uuidCache.set(key, uuids);
    return uuids;
  }

  private async _materialize(
    token: string,
    filters: Record<string, unknown>,
    count: number,
  ): Promise<void> {
    const uuids = await this.resolveUuids(filters, count);

    // Zaznaczenie mogło się w międzyczasie zmienić — wynik dla nieaktualnych filtrów odrzucamy.
    if (this._filterToken(this.selection()?.filters) !== token) return;

    this._materialized.set({ token, uuids });
  }

  private _filterToken(filters: Record<string, unknown> | null | undefined): string {
    return JSON.stringify(filters ?? {});
  }
}
