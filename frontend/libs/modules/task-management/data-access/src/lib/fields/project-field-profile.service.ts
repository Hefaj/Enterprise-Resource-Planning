import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  GetProjectFieldProfileRequest,
  ProjectFieldDto,
  ProjectFieldProfileDto,
  TaskManagementClient,
} from '../api-client';

/**
 * Profil pól niestandardowych projektu — <b>jedyne źródło kolumn projekto-specyficznych,
 * filtrów po nich i whitelisty sortowania po stronie frontu</b>
 * (`docs/modules/task-management/domain.md` §6).
 *
 * <p>Backend czyta z tego samego profilu, tłumacząc kod pola na slot w `ORDER BY`. Dlatego
 * front nie ma prawa zbudować kolumny ani filtra ze stałej w komponencie: rozjazd objawiłby
 * się jako sortowanie odrzucone przez whitelistę, czyli lista, która po kliknięciu w nagłówek
 * nie zmienia kolejności i nie mówi dlaczego.</p>
 *
 * <p><b>Dlaczego zwykły serwis, a nie orkiestrator</b> — ten sam powód, co przy
 * `ProjectWorkflowService`: profil czyta się per projekt, jednym żądaniem, i nie ma listy,
 * więc `BaseOrchestrator` musiałby udawać wyszukiwanie, którego backend nie wystawia.</p>
 */
@Injectable({ providedIn: 'root' })
export class ProjectFieldProfileService {
  private readonly _api = inject(TaskManagementClient);

  private readonly _byProject = signal<ReadonlyMap<string, ProjectFieldProfileDto>>(new Map());
  private readonly _inFlight = new Map<string, Promise<ProjectFieldProfileDto | undefined>>();

  /** Profil projektu, jeśli jest już w cache. Nie odpala żądania — do tego jest `loadAsync`. */
  public getOne(projectUuid: string | null | undefined): Signal<ProjectFieldProfileDto | undefined> {
    return computed(() => (projectUuid ? this._byProject().get(projectUuid) : undefined));
  }

  /**
   * Pola projektu w kolejności `orderNo`, albo pusta lista.
   *
   * <p><b>Pusta lista jest poprawną odpowiedzią</b>, nie stanem przejściowym: projekt bez
   * schematu pól to stan normalny i tabela ma się wtedy narysować bez kolumn
   * projekto-specyficznych, a nie czekać.</p>
   */
  public fieldsOf(projectUuid: string | null | undefined): Signal<ProjectFieldDto[]> {
    return computed(() => (projectUuid ? (this._byProject().get(projectUuid)?.fields ?? []) : []));
  }

  /** Pola, po których wolno sortować i filtrować — czyli te, które mają slot. */
  public sortableFieldsOf(projectUuid: string | null | undefined): Signal<ProjectFieldDto[]> {
    return computed(() => this.fieldsOf(projectUuid)().filter((field) => field.isSortable));
  }

  /**
   * Dociąga profil projektu. Równoległe wywołania dla tego samego projektu dzielą jedno
   * żądanie — filtr, tabela i karta pytają o to samo w tej samej chwili.
   */
  public async loadAsync(projectUuid: string): Promise<ProjectFieldProfileDto | undefined> {
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

  /** Wyrzuca profil z cache — po zmianie definicji pól na karcie projektu. */
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

  private async _fetch(projectUuid: string): Promise<ProjectFieldProfileDto | undefined> {
    try {
      const dto = await firstValueFrom(
        this._api.getProjectFieldProfile({ projectUuid } as GetProjectFieldProfileRequest),
      );

      this._byProject.update((map) => new Map(map).set(projectUuid, dto));
      return dto;
    } catch (error) {
      // Brak dostępu do projektu wraca jako 404 — to granica widoczności, nie awaria.
      // Lista renderuje się wtedy bez kolumn projekto-specyficznych.
      console.error('[ProjectFieldProfileService] Nie udało się pobrać profilu pól projektu.', error);
      return undefined;
    }
  }
}
