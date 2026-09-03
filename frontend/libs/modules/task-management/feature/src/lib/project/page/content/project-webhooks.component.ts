import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpTranslatePipe,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpHasPermissionDirective } from '@erp/shared/auth';
import { ProjectVM, TaskManagementWebhookOrchestrator, WebhookDeliveryDto, WebhookDto } from '@erp/task-management/data-access';
import { AUTOMATION_TRIGGER_KIND, AutomationTriggerKindValue, WEBHOOK_DELIVERY_STATUS } from '@erp/task-management/util';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka „Webhooki" na karcie projektu (faza 8, API-004) — wzorem „Automatyzacje": lista
 * zarządzana z tej jednej zakładki, edycja w panelu pod listą, nie w osobnym modalu.
 *
 * <p><b>Sekret nigdy nie wraca z API po zapisie</b> (`WebhookDto` go nie niesie) — pole sekretu
 * w edytorze zaczyna puste także przy edycji istniejącego webhooka; puste pole przy zapisie
 * znaczy „zostaw obecny sekret" (`WebhookSetCommandHandler`), nie „ustaw pusty".</p>
 */
@Component({
  selector: 'erp-task-management-project-webhooks',
  standalone: true,
  imports: [DatePipe, ErpButtonComponent, ErpHasPermissionDirective, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.webhooks.title | erpTranslate }}</span>

        <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.WebhookManage">
          @if (this.editingUuid() === null) {
            <erp-button [config]="this.addWebhookButton" />
          }
        </ng-container>
      </div>

      @if (this.webhooks().length === 0 && this.editingUuid() === null) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.webhooks.empty | erpTranslate }}
        </span>
      }

      @for (webhook of this.webhooks(); track webhook.uuid) {
        <div class="rounded-md border border-[var(--tui-border-normal)] p-3">
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-medium" [class.opacity-50]="!webhook.isEnabled">{{ webhook.url }}</span>

            @for (kind of webhook.eventKinds; track kind) {
              <span class="rounded bg-[var(--tui-background-neutral-1)] px-2 py-0.5 text-xs">
                {{ this.eventLabel(kind) }}
              </span>
            }

            @if (webhook.consecutiveFailureCount > 0) {
              <span class="text-xs text-[var(--tui-status-negative)]">
                {{ PROJECT_KEYS.detail.webhooks.failureCount | erpTranslate: { count: webhook.consecutiveFailureCount } }}
              </span>
            }

            <div class="flex-1"></div>

            <erp-button [config]="this.deliveriesButton(webhook)" />

            <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.WebhookManage">
              <erp-button [config]="this.toggleEnabledButton(webhook)" />
              <erp-button [config]="this.editWebhookButton(webhook)" />
              <erp-button [config]="this.removeWebhookButton(webhook)" />
            </ng-container>
          </div>

          @if (this.deliveriesUuid() === webhook.uuid) {
            <div class="mt-2 flex flex-col gap-1 border-t border-[var(--tui-border-normal)] pt-2">
              @if (this.deliveries().length === 0) {
                <span class="text-xs text-[var(--tui-text-secondary)]">
                  {{ PROJECT_KEYS.detail.webhooks.deliveriesEmpty | erpTranslate }}
                </span>
              } @else {
                @for (delivery of this.deliveries(); track delivery.uuid) {
                  <div class="flex gap-2 text-xs">
                    <span [class.text-[var(--tui-status-negative)]]="delivery.status === WEBHOOK_DELIVERY_STATUS.Failed">
                      {{ this.statusLabel(delivery.status) }}
                    </span>
                    <span class="text-[var(--tui-text-tertiary)]">{{ this.eventLabel(delivery.eventKind) }}</span>
                    <span class="text-[var(--tui-text-tertiary)]">{{ delivery.createdAt | date: 'short' }}</span>
                    @if (delivery.lastError) {
                      <span class="text-[var(--tui-text-secondary)]">{{ delivery.lastError }}</span>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
      }

      @if (this.editingUuid() !== null) {
        <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium">{{ PROJECT_KEYS.detail.webhooks.editor.urlLabel | erpTranslate }}</span>
            <input
              class="w-full rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-sm"
              type="text"
              [formControl]="this.urlControl"
              [placeholder]="PROJECT_KEYS.detail.webhooks.editor.urlPlaceholder | erpTranslate"
            />
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium">{{ PROJECT_KEYS.detail.webhooks.editor.secretLabel | erpTranslate }}</span>
            <input
              class="w-full rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1 text-sm"
              type="text"
              [formControl]="this.secretControl"
            />
            <span class="text-xs text-[var(--tui-text-secondary)]">
              {{ PROJECT_KEYS.detail.webhooks.editor.secretHint | erpTranslate }}
            </span>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium">{{ PROJECT_KEYS.detail.webhooks.editor.eventsLabel | erpTranslate }}</span>
            <div class="flex flex-wrap gap-3">
              @for (event of this.eventOptions(); track event.value) {
                <label class="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    [checked]="this.selectedEvents().includes(event.value)"
                    (change)="this.toggleEvent(event.value)"
                  />
                  {{ event.label }}
                </label>
              }
            </div>

            @if (this.selectedEvents().length === 0) {
              <span class="text-xs text-[var(--tui-status-negative)]">
                {{ PROJECT_KEYS.detail.webhooks.editor.eventRequired | erpTranslate }}
              </span>
            }
            <span class="text-xs text-[var(--tui-text-secondary)]">
              {{ PROJECT_KEYS.detail.webhooks.editor.eventsHint | erpTranslate }}
            </span>
          </div>

          <div class="flex justify-end gap-2">
            <erp-button [config]="this.cancelEditButton" />
            <erp-button [config]="this.saveWebhookButton" />
          </div>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWebhooksComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;
  protected readonly WEBHOOK_DELIVERY_STATUS = WEBHOOK_DELIVERY_STATUS;

  private readonly _webhooks = inject(TaskManagementWebhookOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _transloco = inject(TranslocoService);
  private readonly _translationsReady = injectTranslationsReadySignal();

  public readonly project = input.required<ProjectVM>();

  private readonly _webhookUuids = signal<string[]>([]);
  private readonly _saving = signal<boolean>(false);

  protected readonly deliveriesUuid = signal<string | null>(null);
  protected readonly deliveries = signal<WebhookDeliveryDto[]>([]);

  protected readonly editingUuid = signal<string | null>(null);
  protected readonly urlControl = new FormControl<string>('', { nonNullable: true });
  protected readonly secretControl = new FormControl<string>('', { nonNullable: true });
  protected readonly selectedEvents = signal<AutomationTriggerKindValue[]>([]);

  protected readonly webhooks = computed<WebhookDto[]>(() => {
    const viewModels = this._webhooks.getViewModel()();

    return this._webhookUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((webhook): webhook is WebhookDto => webhook !== undefined)
      .sort((a, b) => a.url.localeCompare(b.url));
  });

  protected readonly eventOptions = computed(() => {
    this._translationsReady();
    return [
      { value: AUTOMATION_TRIGGER_KIND.IssueCreated, label: this._transloco.translate(PROJECT_KEYS.detail.webhooks.event.issueCreated) },
      {
        value: AUTOMATION_TRIGGER_KIND.IssueStateChanged,
        label: this._transloco.translate(PROJECT_KEYS.detail.webhooks.event.issueStateChanged),
      },
      { value: AUTOMATION_TRIGGER_KIND.CommentAdded, label: this._transloco.translate(PROJECT_KEYS.detail.webhooks.event.commentAdded) },
      {
        value: AUTOMATION_TRIGGER_KIND.DueDateElapsed,
        label: this._transloco.translate(PROJECT_KEYS.detail.webhooks.event.dueDateElapsed),
      },
    ];
  });

  protected readonly statusLabels = computed(() => {
    this._translationsReady();
    return {
      [WEBHOOK_DELIVERY_STATUS.Pending]: this._transloco.translate(PROJECT_KEYS.detail.webhooks.status.pending),
      [WEBHOOK_DELIVERY_STATUS.Sent]: this._transloco.translate(PROJECT_KEYS.detail.webhooks.status.sent),
      [WEBHOOK_DELIVERY_STATUS.Failed]: this._transloco.translate(PROJECT_KEYS.detail.webhooks.status.failed),
    };
  });

  protected eventLabel(kind: number): string {
    return this.eventOptions().find((option) => option.value === kind)?.label ?? '';
  }

  protected statusLabel(status: number): string {
    return this.statusLabels()[status as keyof ReturnType<typeof this.statusLabels>] ?? '';
  }

  protected readonly addWebhookButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.webhooks.addWebhook,
    appearance: 'primary',
    size: 's',
    fn: (): void => this.startCreate(),
  };

  protected editWebhookButton(webhook: WebhookDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.webhooks.edit,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => this.startEdit(webhook),
    };
  }

  protected toggleEnabledButton(webhook: WebhookDto): ErpButtonConfig {
    return webhook.isEnabled
      ? {
          label: PROJECT_KEYS.detail.webhooks.disable,
          appearance: 'flat',
          size: 'xs',
          fn: (): Promise<void> => this._toggleEnabledAsync(webhook, false),
        }
      : {
          label: PROJECT_KEYS.detail.webhooks.enable,
          appearance: 'flat',
          size: 'xs',
          fn: (): Promise<void> => this._toggleEnabledAsync(webhook, true),
        };
  }

  protected removeWebhookButton(webhook: WebhookDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.webhooks.remove,
      appearance: 'flat',
      size: 'xs',
      fn: (): Promise<void> => this._removeAsync(webhook),
    };
  }

  protected deliveriesButton(webhook: WebhookDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.webhooks.deliveries,
      appearance: 'flat',
      size: 'xs',
      fn: (): Promise<void> => this._toggleDeliveriesAsync(webhook),
    };
  }

  protected readonly cancelEditButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.webhooks.editor.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.editingUuid.set(null),
  };

  protected readonly saveWebhookButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.webhooks.editor.save,
    appearance: 'primary',
    size: 's',
    loading: this._saving,
    disabled: computed(() => this.selectedEvents().length === 0),
    fn: (): Promise<void> => this._saveAsync(),
  };

  public constructor() {
    // `project` jest inputem wymaganym, ale nie jest jeszcze zamontowany w chwili wykonania
    // konstruktora — odczyt wprost tutaj kończy się `NG0950`, ten sam błąd co przy
    // `ProjectAutomationsComponent`/`IssueSetProjectStepComponent`.
    effect(() => {
      this.project();
      untracked(() => void this._loadAsync());
    });
  }

  protected startCreate(): void {
    this.editingUuid.set('new');
    this.urlControl.setValue('');
    this.secretControl.setValue('');
    this.selectedEvents.set([AUTOMATION_TRIGGER_KIND.IssueCreated]);
  }

  protected startEdit(webhook: WebhookDto): void {
    this.editingUuid.set(webhook.uuid);
    this.urlControl.setValue(webhook.url);
    this.secretControl.setValue('');
    this.selectedEvents.set(webhook.eventKinds as AutomationTriggerKindValue[]);
  }

  protected toggleEvent(kind: AutomationTriggerKindValue): void {
    this.selectedEvents.update((kinds) =>
      kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind],
    );
  }

  private async _saveAsync(): Promise<void> {
    const url = this.urlControl.value.trim();

    if (!url || this.selectedEvents().length === 0) {
      return;
    }

    this._saving.set(true);

    try {
      const editing = this.editingUuid();

      if (editing === 'new') {
        await this._webhooks.createMultipleAsync({
          uuid: crypto.randomUUID(),
          projectUuid: this.project().uuid,
          url,
          secret: this.secretControl.value.trim(),
          eventKinds: this.selectedEvents(),
        });
      } else if (editing) {
        await this._webhooks.setMultipleAsync({
          uuid: editing,
          url,
          secret: this.secretControl.value.trim(),
          eventKinds: this.selectedEvents(),
        });
      }

      this.editingUuid.set(null);
      await this._loadAsync();
    } catch (error) {
      console.error('[ProjectWebhooksComponent] Nie udało się zapisać webhooka.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _toggleEnabledAsync(webhook: WebhookDto, enable: boolean): Promise<void> {
    if (enable) {
      await this._webhooks.execEnableMultipleAsync({ uuid: webhook.uuid });
    } else {
      await this._webhooks.execDisableMultipleAsync({ uuid: webhook.uuid });
    }

    await this._loadAsync();
  }

  private async _removeAsync(webhook: WebhookDto): Promise<void> {
    await this._confirm.confirmThenAsync(
      {
        title: PROJECT_KEYS.detail.webhooks.removeConfirm.title,
        message: PROJECT_KEYS.detail.webhooks.removeConfirm.message,
      },
      async () => {
        await this._webhooks.removeMultipleAsync({ uuid: webhook.uuid });
        await this._loadAsync();
      },
    );
  }

  private async _toggleDeliveriesAsync(webhook: WebhookDto): Promise<void> {
    if (this.deliveriesUuid() === webhook.uuid) {
      this.deliveriesUuid.set(null);
      return;
    }

    this.deliveriesUuid.set(webhook.uuid);
    this.deliveries.set(await this._webhooks.getRecentDeliveriesAsync(webhook.uuid));
  }

  private async _loadAsync(): Promise<void> {
    try {
      const webhooks = await this._webhooks.searchWebhooksAsync({ projectUuid: this.project().uuid });
      this._webhookUuids.set(webhooks.map((webhook) => webhook.uuid));
    } catch (error) {
      console.error('[ProjectWebhooksComponent] Nie udało się pobrać listy webhooków.', error);
    }
  }
}
