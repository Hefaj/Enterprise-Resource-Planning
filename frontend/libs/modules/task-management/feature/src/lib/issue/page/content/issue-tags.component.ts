import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { JobService } from '@erp/shared/data-access';
import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpToastService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpHasPermissionDirective, PermissionStore } from '@erp/shared/auth';
import {
  TagVM,
  TaskManagementIssueOrchestrator,
  TaskManagementTagOrchestrator,
  erpAwaitJobAsync,
} from '@erp/task-management/data-access';
import { ErpTagChipsComponent, ErpTagChipsConfig } from '@erp/task-management/ui';

import { ISSUE_KEYS } from '../../translation';

/**
 * Tagi na karcie zgłoszenia (TAG-001) — chipsy usuwalne plus picker do dopięcia istniejącego
 * tagu; założenie nowego jest osobnym, zwężonym uprawnieniem (`taskmgmt.tag.manage`, TAG-002).
 *
 * <p>Backend przechowuje przypisanie jako `issue_tag` (join), nie jako pole w `custom_fields` —
 * front nie ma tu żadnej logiki filtrowania, tylko dopięcie/odpięcie i odczyt gotowej listy
 * `IssueDto.tagUuids`.</p>
 */
@Component({
  selector: 'erp-task-management-issue-tags',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpGroupCardComponent,
    ErpInputComponent,
    ErpInputPickerComponent,
    ErpTagChipsComponent,
    ErpHasPermissionDirective,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <erp-group-card [config]="this.cardConfig()">
      <div class="flex flex-col gap-2">
        <erp-tag-chips [config]="this.chipsConfig()" (remove)="this.removeAsync($event)" />

        @if (this.canEdit()) {
          <div class="flex items-center gap-2">
            <erp-input-picker class="min-w-40" [config]="this.pickerConfig()" [control]="this.pickerControl" />

            <ng-container *erpHasPermission="ERP_PERMISSIONS.TaskManagement.TagManage">
              <erp-input class="min-w-40" [config]="this.newTagInputConfig" [control]="this.newTagControl" />
              <erp-button [config]="this.createButton()" />
            </ng-container>
          </div>
        }
      </div>
    </erp-group-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueTagsComponent {
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;

  private readonly _tags = inject(TaskManagementTagOrchestrator);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _jobs = inject(JobService);
  private readonly _toast = inject(ErpToastService);
  private readonly _permissionStore = inject(PermissionStore);

  public readonly issueUuid = input.required<string>();

  public readonly projectUuid = input.required<string>();

  public readonly tagUuids = input<readonly string[]>([]);

  protected readonly canEdit = computed(() => this._permissionStore.has(ERP_PERMISSIONS.TaskManagement.IssueUpdate));

  protected readonly creating = signal<boolean>(false);

  protected readonly newTagControl = new FormControl<string>('');

  protected readonly newTagInputConfig: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setType('text').setPlaceholder(ISSUE_KEYS.detail.tags.newPlaceholder),
  );

  private readonly _projectTagUuids = signal<string[]>([]);

  protected readonly pickerControl = new FormControl<string | null>(null);

  private readonly _attachedTags = computed<TagVM[]>(() => {
    const viewModels = this._tags.getViewModel()();

    return this.tagUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((tag): tag is TagVM => tag !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  private readonly _availableTags = computed<TagVM[]>(() => {
    const viewModels = this._tags.getViewModel()();
    const attached = new Set(this.tagUuids());

    return this._projectTagUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((tag): tag is TagVM => tag !== undefined && !attached.has(tag.uuid))
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  protected readonly chipsConfig = computed<ErpTagChipsConfig>(() => ({
    items: this._attachedTags().map((tag) => ({ value: tag.uuid, label: tag.name, translate: false })),
    removable: this.canEdit(),
    size: 's',
  }));

  protected readonly pickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(ISSUE_KEYS.detail.tags.addLabel)
        .setItems(this._availableTags())
        .setLabelKey('name')
        .setValueKey('uuid')
        .setStrategy('single'),
    ),
  );

  private readonly _cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.tags.titleWithCount, params: { count: this.tagUuids().length } },
    icon: '@tui.tag',
  }));

  protected readonly cardConfig = this._cardConfig;

  public constructor() {
    effect(() => {
      const projectUuid = this.projectUuid();
      untracked(() => void this._loadProjectTagsAsync(projectUuid));
    });

    this.pickerControl.valueChanges.subscribe((tagUuid) => {
      if (tagUuid) {
        void this._attachAsync(tagUuid);
      }
    });
  }

  protected async removeAsync(tagUuid: string): Promise<void> {
    await this._issues.removeTagOptimisticAsync(this.issueUuid(), tagUuid, {
      failureMessage: ISSUE_KEYS.detail.tags.attachFailed,
    });
  }

  protected createButton(): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.tags.create,
      appearance: 'flat',
      size: 'xs',
      disabled: !this.newTagControl.value?.trim() || this.creating(),
      loading: this.creating(),
      fn: (): Promise<void> => this.createAndAttachAsync(),
    };
  }

  protected async createAndAttachAsync(): Promise<void> {
    const name = this.newTagControl.value?.trim();
    if (!name) {
      return;
    }

    this.creating.set(true);

    try {
      const uuid = crypto.randomUUID();
      const jobUuid = await this._tags.createMultipleAsync({ uuid, projectUuid: this.projectUuid(), name });
      await erpAwaitJobAsync(this._jobs, jobUuid);

      this.newTagControl.setValue('');
      this._projectTagUuids.update((uuids) => [...uuids, uuid]);

      await this._attachAsync(uuid);
    } catch (error) {
      console.error('[IssueTagsComponent] Nie udało się utworzyć tagu.', error);
      this._toast.show({ message: ISSUE_KEYS.detail.tags.createFailed, appearance: 'negative' });
    } finally {
      this.creating.set(false);
    }
  }

  private async _attachAsync(tagUuid: string): Promise<void> {
    this.pickerControl.setValue(null, { emitEvent: false });

    await this._issues.addTagOptimisticAsync(this.issueUuid(), tagUuid, {
      failureMessage: ISSUE_KEYS.detail.tags.attachFailed,
    });
  }

  private async _loadProjectTagsAsync(projectUuid: string): Promise<void> {
    if (!projectUuid) {
      return;
    }

    try {
      const tags = await this._tags.searchTagsAsync({ projectUuid });
      this._projectTagUuids.set(tags.map((tag) => tag.uuid));
    } catch (error) {
      console.error('[IssueTagsComponent] Nie udało się pobrać tagów projektu.', error);
    }
  }
}
