import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import { SearchResponse, SearchTagRequest, TagCreateCommand, TagDto, TaskManagementClient } from '../../api-client';
import { TagVM } from './tag.view-model';

/**
 * Orkiestrator tagów (TAG-001).
 *
 * <p>Backend nie ma <c>getTag</c> — katalog tagów jest mały (globalne plus własne projektu),
 * więc uzupełnienie cache'u po uuid idzie przez <c>searchTag</c> bez filtra projektu i lokalne
 * dopasowanie, tak samo jak przy słownikach fazy 4 bez osobnego odczytu pojedynczego wiersza.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementTagOrchestrator extends BaseOrchestrator<TagDto, TagVM, SearchTagRequest, LoadOptions> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.tag';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.tag',
    maxCacheSize: 1000,
  };

  protected override fetchByUuids(uuids: string[]): Observable<TagDto[]> {
    const wanted = new Set(uuids);

    return this._api.searchTag({} as SearchTagRequest).pipe(map((tags) => tags.filter((tag) => wanted.has(tag.uuid))));
  }

  protected override searchByFilters(filters: SearchTagRequest): Observable<SearchResponse> {
    return this._api
      .searchTag(filters)
      .pipe(map((tags) => ({ uuids: tags.map((tag) => tag.uuid), totalCount: tags.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: TagDto): TagVM {
    return dto;
  }

  /**
   * Tagi widoczne na projekcie (globalne plus jego własne) — używane przez picker tagów.
   *
   * <p>Zapisuje wynik do identity mapy I OD RAZU oznacza te uuid jako „załadowane"
   * (`loadAsync` — bez sieciowego pobrania, bo `getMissing` widzi je już w cache'u): inaczej
   * `getViewModel()` nigdy by ich nie pokazał, bo filtruje po zbiorze uuid przekazanych
   * kiedyś do `loadAsync`, nie po samej zawartości identity mapy.</p>
   */
  public async searchTagsAsync(request: SearchTagRequest): Promise<TagDto[]> {
    const tags = await this.runDirectCommandAsync(() => this._api.searchTag(request));
    this.identityMap.setMany(tags);
    await this.loadAsync(tags.map((tag) => tag.uuid));
    return tags;
  }

  public createMultipleAsync(command: TagCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.tagCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createTag,
      queueId,
    });
  }
}
