import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  AutomationRuleCreateCommand,
  AutomationRuleDto,
  AutomationRuleExecDisableCommand,
  AutomationRuleExecEnableCommand,
  AutomationRuleRemoveCommand,
  AutomationRuleSetCommand,
  AutomationRunDto,
  SearchAutomationRuleRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { AutomationRuleVM } from './automation-rule.view-model';

/** Orkiestrator reguł automatyzacji (faza 8, AUT-001/AUT-002). */
@Injectable({ providedIn: 'root' })
export class TaskManagementAutomationRuleOrchestrator extends BaseOrchestrator<
  AutomationRuleDto,
  AutomationRuleVM,
  SearchAutomationRuleRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.automation_rule';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.automation_rule',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<AutomationRuleDto[]> {
    // Backend nie ma `getAutomationRule` — reguł na projekt jest niewiele, więc uzupełnienie
    // cache'u po uuid idzie przez `searchAutomationRule` bez zawężenia i lokalne dopasowanie,
    // tym samym wzorcem co `TaskManagementTagOrchestrator.fetchByUuids`. Filtr projektu jest tu
    // niedostępny (nie znamy go z samego uuid), więc idzie po WSZYSTKICH projektach naraz —
    // akceptowalne przy skali reguł automatyzacji, tak jak przy tagach.
    const wanted = new Set(uuids);

    return this._api
      .searchAutomationRule({} as SearchAutomationRuleRequest)
      .pipe(map((rules) => rules.filter((rule) => wanted.has(rule.uuid))));
  }

  protected override searchByFilters(filters: SearchAutomationRuleRequest): Observable<SearchResponse> {
    return this._api
      .searchAutomationRule(filters)
      .pipe(map((rules) => ({ uuids: rules.map((rule) => rule.uuid), totalCount: rules.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: AutomationRuleDto): AutomationRuleVM {
    return dto;
  }

  /**
   * Reguły projektu — zapisuje wynik do identity mapy I OD RAZU oznacza uuid jako „załadowane"
   * (`loadAsync` bez sieciowego pobrania, `getMissing` widzi je już w cache'u). Bez tego
   * `getViewModel()` zwraca pustkę mimo poprawnej odpowiedzi API — ten sam bug złapany trzy razy
   * w fazie 6 (Sprint/Tag/Resolution), patrz `TaskManagementTagOrchestrator.searchTagsAsync`.
   */
  public async searchAutomationRulesAsync(request: SearchAutomationRuleRequest): Promise<AutomationRuleDto[]> {
    const rules = await this.runDirectCommandAsync(() => this._api.searchAutomationRule(request));
    this.identityMap.setMany(rules);
    await this.loadAsync(rules.map((rule) => rule.uuid));
    return rules;
  }

  /** Log ostatnich uruchomień jednej reguły (AUT-002 AC1) — panel pod listą, nie cache'owane
   * w identity mapie (log rośnie i nie jest samodzielnym agregatem adresowanym po uuid). */
  public getRecentRunsAsync(ruleUuid: string, limit = 20): Promise<AutomationRunDto[]> {
    return this.runDirectCommandAsync(() => this._api.getAutomationRuleRuns({ ruleUuid, limit }));
  }

  public createMultipleAsync(command: AutomationRuleCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.automationRuleCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createAutomationRule,
      queueId,
    });
  }

  public setMultipleAsync(command: AutomationRuleSetCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.automationRuleSetMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setAutomationRule,
      queueId,
    });
  }

  public execEnableMultipleAsync(command: AutomationRuleExecEnableCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.automationRuleExecEnableMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execEnableAutomationRule,
      queueId,
    });
  }

  public execDisableMultipleAsync(command: AutomationRuleExecDisableCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.automationRuleExecDisableMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execDisableAutomationRule,
      queueId,
    });
  }

  public removeMultipleAsync(command: AutomationRuleRemoveCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.automationRuleRemoveMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeAutomationRule,
      queueId,
    });
  }
}
