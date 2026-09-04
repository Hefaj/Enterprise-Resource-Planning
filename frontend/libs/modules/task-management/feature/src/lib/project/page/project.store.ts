import { Injectable, computed, inject, signal } from '@angular/core';

import { ProjectVM, SearchProjectRequest, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';

/**
 * Stan strony `/task-management/project`.
 *
 * <p>Świadomie <b>bez `ErpSelectionScope`</b>: projektów są dziesiątki, a operacji masowych na
 * nich nie ma i nie będzie — konfiguracja projektu to praca po jednym, na jego karcie
 * (`docs/modules/task-management/screens.md` §4.1). Dokładanie zaznaczenia „na wszelki wypadek"
 * dawałoby toolbar bez akcji.</p>
 */
@Injectable()
export class ProjectStore {
  private readonly _orchestrator = inject(TaskManagementProjectOrchestrator);

  public readonly filters = signal<Partial<SearchProjectRequest>>({});
  public readonly loading = signal<boolean>(false);

  public readonly projects = computed<ProjectVM[]>(() => [...this._orchestrator.getViewModel()().values()]);

  public updateFilters(partial: Partial<SearchProjectRequest>): void {
    this.filters.update((current) => ({ ...current, ...partial }));
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
}
