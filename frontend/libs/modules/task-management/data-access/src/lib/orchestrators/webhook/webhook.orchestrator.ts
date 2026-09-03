import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  SearchResponse,
  SearchWebhookRequest,
  TaskManagementClient,
  WebhookCreateCommand,
  WebhookDeliveryDto,
  WebhookDto,
  WebhookExecDisableCommand,
  WebhookExecEnableCommand,
  WebhookRemoveCommand,
  WebhookSetCommand,
} from '../../api-client';
import { WebhookVM } from './webhook.view-model';

/** Orkiestrator webhooków wychodzących (faza 8, API-004). */
@Injectable({ providedIn: 'root' })
export class TaskManagementWebhookOrchestrator extends BaseOrchestrator<
  WebhookDto,
  WebhookVM,
  SearchWebhookRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.webhook';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.webhook',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<WebhookDto[]> {
    // Backend nie ma `getWebhook` — webhooków na projekt jest niewiele, wzorem
    // `TaskManagementAutomationRuleOrchestrator.fetchByUuids`.
    const wanted = new Set(uuids);

    return this._api
      .searchWebhook({} as SearchWebhookRequest)
      .pipe(map((webhooks) => webhooks.filter((webhook) => wanted.has(webhook.uuid))));
  }

  protected override searchByFilters(filters: SearchWebhookRequest): Observable<SearchResponse> {
    return this._api
      .searchWebhook(filters)
      .pipe(
        map((webhooks) => ({ uuids: webhooks.map((webhook) => webhook.uuid), totalCount: webhooks.length }) as SearchResponse),
      );
  }

  protected override mapToViewModel(dto: WebhookDto): WebhookVM {
    return dto;
  }

  /** Webhooki projektu — zapisuje wynik do identity mapy I OD RAZU oznacza uuid jako
   * „załadowane", ten sam wzorzec co `TaskManagementAutomationRuleOrchestrator.searchAutomationRulesAsync`
   * (bez tego `getViewModel()` zwraca pustkę mimo poprawnej odpowiedzi API). */
  public async searchWebhooksAsync(request: SearchWebhookRequest): Promise<WebhookDto[]> {
    const webhooks = await this.runDirectCommandAsync(() => this._api.searchWebhook(request));
    this.identityMap.setMany(webhooks);
    await this.loadAsync(webhooks.map((webhook) => webhook.uuid));
    return webhooks;
  }

  /** Ostatnie dostarczenia jednego webhooka — panel pod listą, nie cache'owane w identity mapie
   * (rośnie i nie jest samodzielnym agregatem adresowanym po uuid). */
  public getRecentDeliveriesAsync(webhookUuid: string, limit = 20): Promise<WebhookDeliveryDto[]> {
    return this.runDirectCommandAsync(() => this._api.getWebhookDeliveries({ webhookUuid, limit }));
  }

  public createMultipleAsync(command: WebhookCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.webhookCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createWebhook,
      queueId,
    });
  }

  public setMultipleAsync(command: WebhookSetCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.webhookSetMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setWebhook,
      queueId,
    });
  }

  public execEnableMultipleAsync(command: WebhookExecEnableCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.webhookExecEnableMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execEnableWebhook,
      queueId,
    });
  }

  public execDisableMultipleAsync(command: WebhookExecDisableCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.webhookExecDisableMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execDisableWebhook,
      queueId,
    });
  }

  public removeMultipleAsync(command: WebhookRemoveCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.webhookRemoveMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeWebhook,
      queueId,
    });
  }
}
