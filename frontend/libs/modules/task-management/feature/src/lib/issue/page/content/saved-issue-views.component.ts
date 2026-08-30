import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ErpButtonBuilder, ErpButtonComponent, ErpInputBuilder, ErpInputComponent, ErpInputPickerBuilder, ErpInputPickerComponent } from '@erp/shared/ui';
import { SavedIssueViewDto, TaskManagementClient } from '@erp/task-management/data-access';

import { IssueStore } from '../issue.store';
import { ISSUE_KEYS } from '../../translation';

/** Zapisane widoki są częścią listy zgłoszeń, więc używają jej store'a jako jedynego źródła
 * filtrów i sortowania — własny formularz nie kopiuje stanu tabeli. */
@Component({
  selector: 'erp-task-management-saved-issue-views',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ReactiveFormsModule],
  template: `
    <div class="flex flex-wrap items-end gap-2">
      <erp-input-picker
        class="min-w-64"
        [config]="viewPickerConfig()"
        [control]="selectedView"
      />
      <erp-input
        class="min-w-56"
        [config]="nameInput"
        [control]="name"
      />
      <erp-button [config]="saveButton" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedIssueViewsComponent {
  private readonly _api = inject(TaskManagementClient);
  private readonly _store = inject(IssueStore);

  protected readonly views = signal<readonly SavedIssueViewDto[]>([]);
  protected readonly selectedView = new FormControl<string | null>(null);
  protected readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected readonly viewPickerConfig = computed(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<SavedIssueViewDto, string>>((b) =>
      b.setLabel(ISSUE_KEYS.savedViews.label).setSearchPlaceholder(ISSUE_KEYS.savedViews.select).setItems(this.views).setLabelKey('name').setValueKey('uuid').setStrategy('single'),
    ),
  );
  protected readonly nameInput = ErpInputBuilder.create((b) => b.setLabel(ISSUE_KEYS.savedViews.name));
  protected readonly saveButton = ErpButtonBuilder.create((b) =>
    b
      .setLabel(ISSUE_KEYS.savedViews.save)
      .setAppearance('secondary')
      .setFn(() => this._saveAsync()),
  );

  public constructor() {
    this.selectedView.valueChanges.pipe(takeUntilDestroyed()).subscribe((uuid) => this._apply(uuid));
  }

  public ngOnInit(): void {
    void this._loadAsync();
  }

  private _apply(uuid: string | null): void {
    const view = this.views().find((item) => item.uuid === uuid);
    if (!view) {
      return;
    }

    try {
      this._store.updateFilters(JSON.parse(view.filterJson));
      this._store.setSorts(JSON.parse(view.columnsJson).sorts);
    } catch {
      // Uszkodzony, historyczny zapis nie może podmienić aktywnych filtrów.
    }
  }

  private async _saveAsync(): Promise<void> {
    const name = this.name.value.trim();
    if (!name || this.name.invalid) {
      return;
    }

    await firstValueFrom(
      this._api.savedIssueViewCreateCommand({
        name,
        filterJson: JSON.stringify(this._store.filters()),
        columnsJson: JSON.stringify({ sorts: this._store.sorts() }),
        isDefault: false,
      }),
    );
    this.name.reset();
    await this._loadAsync();
  }

  private async _loadAsync(): Promise<void> {
    this.views.set(await firstValueFrom(this._api.getSavedIssueViews()));
  }
}
