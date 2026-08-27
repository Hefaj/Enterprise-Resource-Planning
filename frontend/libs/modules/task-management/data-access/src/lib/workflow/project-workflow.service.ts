import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  GetProjectWorkflowRequest,
  ProjectWorkflowDto,
  TaskManagementClient,
  WorkflowStateDto,
  WorkflowTransitionDto,
} from '../api-client';

/**
 * Schemat stanów projektu — <b>jedyne źródło stanów dla frontu</b>. Filtr stanu na liście,
 * przyciski przejść na karcie i (od fazy 2) kolumny tablicy budują się z tej odpowiedzi;
 * nigdzie w kodzie nie ma twardej stałej „todo/in progress/done".
 *
 * <p><b>Dlaczego zwykły serwis, a nie orkiestrator.</b> `BaseOrchestrator` obsługuje agregaty
 * adresowane po uuid, z wyszukiwaniem i cache'em tożsamości. Schemat czyta się per projekt,
 * jednym żądaniem, i nie ma listy — użycie orkiestratora wymagałoby udawania wyszukiwania,
 * którego backend nie wystawia. Zmiana schematu i tak dociera przez sygnaturę
 * `taskmgmt.workflow_scheme`, ale w fazie 0 nikt jej jeszcze nie zmienia z UI (edytor to faza 7),
 * więc cache czyści się jawnym <see cref="invalidate"/>.</p>
 */
@Injectable({ providedIn: 'root' })
export class ProjectWorkflowService {
  private readonly _api = inject(TaskManagementClient);

  private readonly _byProject = signal<ReadonlyMap<string, ProjectWorkflowDto>>(new Map());
  private readonly _inFlight = new Map<string, Promise<ProjectWorkflowDto | undefined>>();

  /** Schemat projektu, jeśli jest już w cache. Nie odpala żądania — do tego jest `loadAsync`. */
  public getOne(projectUuid: string): Signal<ProjectWorkflowDto | undefined> {
    return computed(() => this._byProject().get(projectUuid));
  }

  /**
   * Stany projektu w kolejności `orderNo`, albo pusta lista, gdy schematu jeszcze nie ma
   * w cache. Pusta lista jest tu poprawnym stanem przejściowym: filtr renderuje się wtedy bez
   * opcji stanu, zamiast blokować całą stronę do czasu odpowiedzi.
   */
  public statesOf(projectUuid: string | null | undefined): Signal<WorkflowStateDto[]> {
    return computed(() => (projectUuid ? (this._byProject().get(projectUuid)?.states ?? []) : []));
  }

  /** Przejścia wychodzące z podanego stanu — zbiór przycisków „przenieś do…" na karcie. */
  public transitionsFrom(projectUuid: string, fromStateUuid: string): Signal<WorkflowTransitionDto[]> {
    return computed(() =>
      (this._byProject().get(projectUuid)?.transitions ?? []).filter((t) => t.fromStateUuid === fromStateUuid),
    );
  }

  /**
   * Dociąga schemat projektu. Równoległe wywołania dla tego samego projektu dzielą jedno
   * żądanie — lista i karta pytają o to samo w tej samej chwili przy wejściu na stronę.
   */
  public async loadAsync(projectUuid: string): Promise<ProjectWorkflowDto | undefined> {
    if (!projectUuid) {
      return undefined;
    }

    const cached = this._byProject().get(projectUuid);
    if (cached) {
      return cached;
    }

    const pending = this._inFlight.get(projectUuid);
    if (pending) {
      return pending;
    }

    const request = this._fetch(projectUuid).finally(() => this._inFlight.delete(projectUuid));
    this._inFlight.set(projectUuid, request);
    return request;
  }

  /** Wyrzuca schemat z cache — po publikacji zmian w edytorze (faza 7). */
  public invalidate(projectUuid?: string): void {
    this._byProject.update((map) => {
      if (!projectUuid) {
        return new Map();
      }
      const next = new Map(map);
      next.delete(projectUuid);
      return next;
    });
  }

  private async _fetch(projectUuid: string): Promise<ProjectWorkflowDto | undefined> {
    try {
      const dto = await firstValueFrom(
        this._api.getProjectWorkflow({ projectUuid } as GetProjectWorkflowRequest),
      );

      this._byProject.update((map) => new Map(map).set(projectUuid, dto));
      return dto;
    } catch (error) {
      // Brak dostępu do projektu wraca jako 404 — to nie jest stan wyjątkowy, tylko granica
      // widoczności. Strona pokaże listę bez filtra stanu zamiast błędu.
      console.error('[ProjectWorkflowService] Nie udało się pobrać schematu stanów projektu.', error);
      return undefined;
    }
  }
}
