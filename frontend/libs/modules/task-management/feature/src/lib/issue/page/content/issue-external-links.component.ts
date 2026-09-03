import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpToastService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { IssueExternalLinkDto, TaskManagementIssueOrchestrator } from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/**
 * Linki zewnętrzne na zgłoszeniu (API-005) — repozytorium kodu, PR, CI. Nigdy integracja
 * w domenie: wyłącznie adres URL z etykietą nadaną przez człowieka.
 *
 * <p>Bez osobnego cache'u/orkiestratora — lista jedzie razem z `IssueDto.externalLinks`, bo to
 * mała, ograniczona kolekcja podrzędna zgłoszenia (wzorem tagów, nie komentarzy).</p>
 */
@Component({
  selector: 'erp-task-management-issue-external-links',
  standalone: true,
  imports: [ErpButtonComponent, ErpGroupCardComponent, ErpInputComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <erp-group-card [config]="this.cardConfig()">
      <div class="flex flex-col gap-2">
        @if (this.links().length === 0) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.detail.externalLinks.empty | erpTranslate }}
          </p>
        } @else {
          <ul class="m-0 flex flex-col gap-1 p-0 text-sm">
            @for (link of this.links(); track link.uuid) {
              <li class="flex items-center gap-2">
                <a class="truncate underline" [href]="link.url" target="_blank" rel="noopener noreferrer">
                  {{ link.label }}
                </a>
                @if (this.canEdit()) {
                  <erp-button [config]="this.removeButton(link)" />
                }
              </li>
            }
          </ul>
        }

        @if (this.canEdit()) {
          <div class="flex flex-wrap items-center gap-2">
            <erp-input class="min-w-40 flex-1" [config]="this.urlInputConfig" [control]="this.urlControl" />
            <erp-input
              class="min-w-32"
              [config]="this.labelInputConfig"
              [control]="this.labelControl"
              (keydown.enter)="this.addAsync()"
            />
            <erp-button [config]="this.addButton()" />
          </div>
        }
      </div>
    </erp-group-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueExternalLinksComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _toast = inject(ErpToastService);

  public readonly issueUuid = input.required<string>();

  public readonly links = input<readonly IssueExternalLinkDto[]>([]);

  public readonly canEdit = input<boolean>(false);

  protected readonly urlControl = new FormControl<string>('', { nonNullable: true });
  protected readonly labelControl = new FormControl<string>('', { nonNullable: true });

  protected readonly urlInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setType('text').setPlaceholder(ISSUE_KEYS.detail.externalLinks.urlPlaceholder),
  );

  protected readonly labelInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setType('text').setPlaceholder(ISSUE_KEYS.detail.externalLinks.labelPlaceholder),
  );

  protected readonly cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.externalLinks.titleWithCount, params: { count: this.links().length } },
    icon: '@tui.link',
  }));

  protected addButton(): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.externalLinks.add,
      appearance: 'flat',
      size: 'xs',
      fn: (): Promise<void> => this.addAsync(),
    };
  }

  protected async addAsync(): Promise<void> {
    const url = this.urlControl.value.trim();
    const label = this.labelControl.value.trim();

    if (!url || !label) {
      return;
    }

    try {
      await this._issues.addExternalLinkAsync({ uuid: this.issueUuid(), url, label });
      this.urlControl.setValue('');
      this.labelControl.setValue('');
    } catch (error) {
      console.error('[IssueExternalLinksComponent] Nie udało się dodać linku.', error);
      this._toast.show({ message: ISSUE_KEYS.detail.externalLinks.addFailed, appearance: 'negative' });
    }
  }

  protected removeButton(link: IssueExternalLinkDto): ErpButtonConfig {
    return {
      label: '',
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      fn: (): Promise<void> => this._removeAsync(link.uuid),
    };
  }

  private async _removeAsync(linkUuid: string): Promise<void> {
    const confirmed = await this._confirm.confirmAsync({
      title: ISSUE_KEYS.detail.externalLinks.removeConfirmTitle,
      message: ISSUE_KEYS.detail.externalLinks.removeConfirmMessage,
      confirmLabel: ISSUE_KEYS.detail.externalLinks.remove,
      appearance: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    await this._issues.removeExternalLinkAsync({ uuid: this.issueUuid(), linkUuid });
  }
}
