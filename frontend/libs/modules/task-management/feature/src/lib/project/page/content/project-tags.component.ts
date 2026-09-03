import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpHasPermissionDirective } from '@erp/shared/auth';
import { ProjectVM, TagDto, TaskManagementTagOrchestrator } from '@erp/task-management/data-access';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka „Tagi" na karcie projektu (TAG-003) — jedyne miejsce, w którym da się zmienić nazwę
 * albo scalić tagi. Poza tym tagi zakłada się wyłącznie w locie z poziomu karty zgłoszenia
 * (`IssueTagsComponent`) — ta zakładka jest katalogiem do zarządzania tym, co już istnieje,
 * wzorem „Typy" (faza 4) i „SLA" (faza 5).
 *
 * <p><b>Bez realtime po scaleniu</b> — merge idzie raw SQL-em po stronie backendu (patrz
 * `TagExecMergeCommandHandler`), więc `AggregateChanged` nie wystrzeli dla dotkniętych zgłoszeń.
 * Ta zakładka i tak przeładowuje tylko listę tagów, którą sama pokazuje — reszta (chipsy na
 * kartach zgłoszeń) doczyta poprawny stan przy najbliższym odświeżeniu tamtej strony.</p>
 */
@Component({
  selector: 'erp-task-management-project-tags',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpHasPermissionDirective,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.tags.title | erpTranslate }}</span>

      @if (this.tags().length === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.tags.empty | erpTranslate }}
        </span>
      } @else {
        <table class="w-full text-sm">
          <tbody>
            @for (tag of this.tags(); track tag.uuid) {
              <tr class="border-t border-[var(--tui-border-normal)]">
                <td class="w-6 py-2">
                  <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="tag.color"></span>
                </td>

                <td class="py-2">
                  @if (this.renamingUuid() === tag.uuid) {
                    <input
                      class="w-48 rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-0.5 text-sm"
                      type="text"
                      [formControl]="this.renameControl"
                      [placeholder]="PROJECT_KEYS.detail.tags.rename.placeholder | erpTranslate"
                      (keydown.enter)="this.confirmRenameAsync(tag)"
                      (keydown.escape)="this.renamingUuid.set(null)"
                    />
                  } @else {
                    {{ tag.name }}
                  }
                </td>

                <td class="py-2 text-right">
                  <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.TagManage">
                    @if (this.renamingUuid() === tag.uuid) {
                      <erp-button [config]="this.confirmRenameButton(tag)" />
                      <erp-button [config]="this.cancelRenameButton" />
                    } @else if (this.mergingUuid() === tag.uuid) {
                      <erp-button [config]="this.cancelMergeButton" />
                    } @else {
                      <erp-button [config]="this.renameButton(tag)" />
                      <erp-button [config]="this.mergeButton(tag)" />
                    }
                  </ng-container>
                </td>
              </tr>

              @if (this.mergingUuid() === tag.uuid) {
                <tr>
                  <td colspan="3" class="pb-3">
                    <div class="flex flex-col gap-2 rounded-md border border-[var(--tui-border-normal)] p-3">
                      <span class="text-xs text-[var(--tui-text-secondary)]">
                        {{ PROJECT_KEYS.detail.tags.merge.confirmMessage | erpTranslate: { name: tag.name } }}
                      </span>
                      <erp-input-picker
                        class="w-64"
                        [config]="this.mergeTargetPickerConfig(tag)"
                        [control]="this.mergeTargetControl"
                      />
                      <div class="flex justify-end">
                        <erp-button [config]="this.confirmMergeButton(tag)" />
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTagsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;

  private readonly _tags = inject(TaskManagementTagOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);

  public readonly project = input.required<ProjectVM>();

  private readonly _tagUuids = signal<string[]>([]);
  private readonly _saving = signal<boolean>(false);

  protected readonly renamingUuid = signal<string | null>(null);
  protected readonly mergingUuid = signal<string | null>(null);
  protected readonly mergeTargetUuid = signal<string | null>(null);

  protected readonly renameControl = new FormControl<string>('', { nonNullable: true });
  protected readonly mergeTargetControl = new FormControl<string | null>(null);

  protected readonly tags = computed<TagDto[]>(() => {
    const viewModels = this._tags.getViewModel()();

    return this._tagUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((tag): tag is TagDto => tag !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  public constructor() {
    // `project` jest inputem wymaganym, ale nie jest jeszcze zamontowany w chwili wykonania
    // konstruktora — odczyt wprost tutaj kończy się `NG0950`, ten sam błąd co przy
    // `IssueSetProjectStepComponent` w fazie 6. `effect()` odkłada pierwszy odczyt do momentu,
    // gdy Angular faktycznie ustawi wartość wejścia.
    effect(() => {
      this.project();
      untracked(() => void this._loadAsync());
    });

    this.mergeTargetControl.valueChanges.subscribe((value) => this.mergeTargetUuid.set(value));
  }

  protected renameButton(tag: TagDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.tags.rename.label,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => {
        this.mergingUuid.set(null);
        this.renameControl.setValue(tag.name);
        this.renamingUuid.set(tag.uuid);
      },
    };
  }

  protected readonly cancelRenameButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.cancel,
    appearance: 'flat',
    size: 'xs',
    fn: () => this.renamingUuid.set(null),
  };

  protected confirmRenameButton(tag: TagDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.save,
      appearance: 'primary',
      size: 'xs',
      loading: this._saving,
      fn: () => this.confirmRenameAsync(tag),
    };
  }

  protected mergeButton(tag: TagDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.tags.merge.label,
      appearance: 'flat',
      size: 'xs',
      fn: (): void => {
        this.renamingUuid.set(null);
        this.mergeTargetControl.setValue(null);
        this.mergingUuid.set(tag.uuid);
      },
    };
  }

  protected readonly cancelMergeButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.cancel,
    appearance: 'flat',
    size: 'xs',
    fn: () => this.mergingUuid.set(null),
  };

  protected confirmMergeButton(tag: TagDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.tags.merge.submit,
      appearance: 'primary',
      size: 'xs',
      loading: this._saving,
      disabled: computed(() => !this.mergeTargetUuid()),
      fn: () => this._confirmMergeAsync(tag),
    };
  }

  protected mergeTargetPickerConfig(source: TagDto): ErpInputPickerConfig {
    return ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.tags.merge.targetLabel)
        .setSearchPlaceholder(PROJECT_KEYS.detail.tags.merge.targetPlaceholder)
        .setItems(this.tags()
          .filter((tag) => tag.uuid !== source.uuid)
          .map((tag) => ({ value: tag.uuid, label: tag.name })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  }

  protected async confirmRenameAsync(tag: TagDto): Promise<void> {
    const name = this.renameControl.value.trim();

    if (!name || name === tag.name) {
      this.renamingUuid.set(null);
      return;
    }

    this._saving.set(true);

    try {
      await this._tags.setNameAsync({ uuid: tag.uuid, name });
      this.renamingUuid.set(null);
      await this._loadAsync();
    } catch (error) {
      console.error('[ProjectTagsComponent] Nie udało się zmienić nazwy tagu.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _confirmMergeAsync(tag: TagDto): Promise<void> {
    const targetUuid = this.mergeTargetUuid();

    if (!targetUuid) {
      return;
    }

    const target = this.tags().find((t) => t.uuid === targetUuid);

    await this._confirm.confirmThenAsync(
      {
        title: { key: PROJECT_KEYS.detail.tags.merge.modalTitle, params: { name: tag.name } },
        message: { key: PROJECT_KEYS.detail.tags.merge.confirmMessage, params: { name: tag.name } },
        details: target ? [`${tag.name} → ${target.name}`] : undefined,
      },
      async () => {
        this._saving.set(true);

        try {
          await this._tags.execMergeAsync({ uuid: tag.uuid, targetTagUuid: targetUuid });
          this.mergingUuid.set(null);
          // Pełne przeładowanie — patrz komentarz klasy: merge nie generuje `AggregateChanged`.
          await this._loadAsync();
        } catch (error) {
          console.error('[ProjectTagsComponent] Nie udało się scalić tagów.', error);
        } finally {
          this._saving.set(false);
        }
      },
    );
  }

  private async _loadAsync(): Promise<void> {
    try {
      const tags = await this._tags.searchTagsAsync({ projectUuid: this.project().uuid });
      this._tagUuids.set(tags.map((tag) => tag.uuid));
    } catch (error) {
      console.error('[ProjectTagsComponent] Nie udało się pobrać listy tagów.', error);
    }
  }
}
