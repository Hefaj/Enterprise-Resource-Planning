import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputBuilder,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { ProjectVM, TagDto, TaskManagementTagOrchestrator } from '@erp/task-management/data-access';
import {
  ErpProjectConfigurationSectionComponent,
  ErpProjectConfigurationSectionConfig,
  ErpProjectTagListComponent,
  ErpProjectTagListConfig,
} from '@erp/task-management/ui';

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
    ErpProjectConfigurationSectionComponent,
    ErpProjectTagListComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <erp-project-configuration-section [config]="this.sectionConfig">

      @if (this.tags().length === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.tags.empty | erpTranslate }}
        </span>
      } @else {
        <erp-project-tag-list [config]="this.tagListConfig()" />
      }
    </erp-project-configuration-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTagsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly sectionConfig: ErpProjectConfigurationSectionConfig = { title: PROJECT_KEYS.detail.tags.title };
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;

  private readonly _tags = inject(TaskManagementTagOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _permissions = inject(PermissionStore);

  public readonly project = input.required<ProjectVM>();

  private readonly _tagUuids = signal<string[]>([]);
  private readonly _saving = signal<boolean>(false);

  protected readonly renamingUuid = signal<string | null>(null);
  protected readonly mergingUuid = signal<string | null>(null);
  protected readonly mergeTargetUuid = signal<string | null>(null);

  protected readonly renameControl = new FormControl<string>('', { nonNullable: true });
  protected readonly mergeTargetControl = new FormControl<string | null>(null);
  protected readonly renameInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setPlaceholder(PROJECT_KEYS.detail.tags.rename.placeholder).setSize('s'),
  );

  protected readonly tags = computed<TagDto[]>(() => {
    const viewModels = this._tags.getViewModel()();

    return this._tagUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((tag): tag is TagDto => tag !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly tagListConfig = computed<ErpProjectTagListConfig>(() => ({
    renameControl: this.renameControl,
    renameInputConfig: this.renameInputConfig,
    rows: this.tags().map((tag) => {
      const editing = this.renamingUuid() === tag.uuid;
      const merging = this.mergingUuid() === tag.uuid;
      const canManage = this._permissions.has(ERP_PERMISSIONS.TaskManagement.TagManage);

      return {
        id: tag.uuid,
        name: tag.name,
        color: tag.color,
        editing,
        merging,
        actions: !canManage
          ? []
          : editing
            ? [this.confirmRenameButton(tag), this.cancelRenameButton]
            : merging
              ? [this.cancelMergeButton]
              : [this.renameButton(tag), this.mergeButton(tag)],
        merge: merging
          ? {
              message: { key: PROJECT_KEYS.detail.tags.merge.confirmMessage, params: { name: tag.name } },
              pickerConfig: this.mergeTargetPickerConfig(tag),
              pickerControl: this.mergeTargetControl,
              confirmButton: this.confirmMergeButton(tag),
            }
          : undefined,
      };
    }),
  }));

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
