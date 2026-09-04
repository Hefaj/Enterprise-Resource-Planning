import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import {
  IssueTypeDto,
  IssueTypeSchemeAddTypeCommand,
  IssueTypeSchemeDto,
  ProjectVM,
  TaskManagementIssueTypeSchemeOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_TYPE_CATEGORY, issueTypeCategoryKey } from '@erp/task-management/util';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka typów na karcie projektu (`TYP-001`) — wybór schematu i lista typów, analogicznie
 * do zakładki pól (`docs/modules/task-management/screens.md` §4.2).
 *
 * <p>Picker startuje zaznaczony na `project().issueTypeSchemeUuid` — to schemat aktualnie
 * podpięty do projektu (`ProjectDto.issueTypeSchemeUuid`, kontrakt fazy 4). Zmiana zaznaczenia
 * w pickerze i „Podepnij" przełącza projekt na inny schemat (`ProjectSetIssueTypeScheme`).</p>
 */
@Component({
  selector: 'erp-task-management-project-types',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4">
      <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.types.title | erpTranslate }}</span>

      <div class="flex items-end gap-3">
        <erp-input-picker class="w-80" [config]="this.schemePickerConfig()" [control]="this.schemeControl" />
        <erp-button [config]="this.attachButton" />
      </div>

      @if (this.types().length === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.types.empty | erpTranslate }}
        </span>
      } @else {
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase text-[var(--tui-text-tertiary)]">
            <tr>
              <th class="py-1">{{ PROJECT_KEYS.detail.types.columns.name | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.types.columns.category | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.types.columns.icon | erpTranslate }}</th>
              <th class="py-1"></th>
            </tr>
          </thead>
          <tbody>
            @for (type of this.types(); track type.uuid) {
              <tr class="border-t border-[var(--tui-border-normal)]">
                <td class="py-2">{{ type.name }}</td>
                <td class="py-2">{{ this.categoryKey(type.category) | erpTranslate }}</td>
                <td class="py-2 font-mono text-xs">{{ type.icon }}</td>
                <td class="py-2 text-right">
                  <erp-button [config]="this.removeButton(type)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (this.scheme()) {
        <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
          <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.types.add.title | erpTranslate }}</span>

          <div class="grid grid-cols-2 gap-3">
            <erp-input [config]="this.nameInput" [formControl]="this.nameControl" />
            <erp-input [config]="this.iconInput" [formControl]="this.iconControl" />
            <erp-input-picker [config]="this.categoryPickerConfig()" [control]="this.categoryControl" />
          </div>

          <div class="flex justify-end">
            <erp-button [config]="this.addButton" />
          </div>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTypesComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _schemes = inject(TaskManagementIssueTypeSchemeOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _transloco = inject(TranslocoService);

  public readonly project = input.required<ProjectVM>();

  private readonly _saving = signal<boolean>(false);
  private readonly _selectedSchemeUuid = signal<string | null>(null);

  protected readonly schemeControl = new FormControl<string | null>(null);
  protected readonly nameControl = new FormControl<string | null>(null);
  protected readonly iconControl = new FormControl<string | null>(null);
  protected readonly categoryControl = new FormControl<number | null>(ISSUE_TYPE_CATEGORY.Standard);

  protected readonly scheme = computed<IssueTypeSchemeDto | undefined>(() => {
    const uuid = this._selectedSchemeUuid();
    return uuid ? this._schemes.getOne(uuid)() : undefined;
  });

  protected readonly types = computed<IssueTypeDto[]>(() => this.scheme()?.types ?? []);

  protected readonly schemePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.types.scheme.label)
        .setPlaceholder(PROJECT_KEYS.detail.types.scheme.placeholder)
        .setItems([...this._schemes.getViewModel()().values()].map((s) => ({ value: s.uuid, label: s.name })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected readonly categoryPickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.types.add.category)
        .setItems([
          { value: ISSUE_TYPE_CATEGORY.Epic, label: this._t(issueTypeCategoryKey(ISSUE_TYPE_CATEGORY.Epic)) },
          { value: ISSUE_TYPE_CATEGORY.Standard, label: this._t(issueTypeCategoryKey(ISSUE_TYPE_CATEGORY.Standard)) },
          { value: ISSUE_TYPE_CATEGORY.Subtask, label: this._t(issueTypeCategoryKey(ISSUE_TYPE_CATEGORY.Subtask)) },
        ])
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected readonly nameInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.types.add.name),
  );

  protected readonly iconInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.types.add.icon).setHint(PROJECT_KEYS.detail.types.add.iconHint),
  );

  protected readonly attachButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.types.scheme.attach,
    appearance: 'secondary',
    size: 'm',
    loading: this._saving,
    fn: () => this._attachAsync(),
  };

  protected readonly addButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.types.add.submit,
    appearance: 'primary',
    size: 'm',
    loading: this._saving,
    fn: () => this._addTypeAsync(),
  };

  public constructor() {
    void this._schemes.searchAsync({}, { autoLoad: true });

    this.schemeControl.valueChanges.pipe().subscribe((value) => this._selectedSchemeUuid.set(value));

    // Picker startuje na schemacie podpiętym do projektu — dopiero świadoma zmiana zaznaczenia
    // (i klik „Podepnij") przełącza projekt na inny. Reaguje tylko, dopóki użytkownik nie tknął
    // pola, inaczej wczytanie projektu w tle nadpisywałoby jego wybór.
    effect(() => {
      const schemeUuid = this.project().issueTypeSchemeUuid;

      untracked(() => {
        if (schemeUuid && !this.schemeControl.dirty) {
          this.schemeControl.setValue(schemeUuid);
        }
      });
    });
  }

  protected categoryKey(category: number): string {
    return issueTypeCategoryKey(category);
  }

  protected removeButton(type: IssueTypeDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.types.remove.label,
      appearance: 'flat',
      size: 's',
      fn: () => this._removeTypeAsync(type),
    };
  }

  private _t(key: string): string {
    return this._transloco.translate(key);
  }

  /** Podpina schemat typów do projektu (`ProjectSetIssueTypeScheme`, `TYP-001`). */
  private async _attachAsync(): Promise<void> {
    const schemeUuid = this.schemeControl.value;

    if (!schemeUuid) {
      return;
    }

    this._saving.set(true);

    try {
      await this._projects.setIssueTypeSchemeAsync({ uuid: this.project().uuid, issueTypeSchemeUuid: schemeUuid });
    } catch (error) {
      console.error('[ProjectTypesComponent] Nie udało się podpiąć schematu typów.', error);
    } finally {
      this._saving.set(false);
    }
  }

  /** Zakłada nowy typ w schemacie (`TYP-002`) — pojawia się w modalu tworzenia zgłoszenia od
   * razu, bez wdrożenia frontu, bo wybór typu czyta się z tego samego orkiestratora. */
  private async _addTypeAsync(): Promise<void> {
    const scheme = this.scheme();
    const name = this.nameControl.value?.trim();

    if (!scheme || !name) {
      return;
    }

    this._saving.set(true);

    try {
      const command: IssueTypeSchemeAddTypeCommand = {
        uuid: scheme.uuid,
        typeUuid: crypto.randomUUID(),
        code: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        icon: this.iconControl.value?.trim() || '@tui.circle-dot',
        category: this.categoryControl.value ?? ISSUE_TYPE_CATEGORY.Standard,
        orderNo: this.types().length,
      };

      await this._schemes.addTypeAsync(command);
      await this._schemes.searchAsync({}, { autoLoad: true });

      this.nameControl.reset();
      this.iconControl.reset();
      this.categoryControl.setValue(ISSUE_TYPE_CATEGORY.Standard);
    } catch (error) {
      console.error('[ProjectTypesComponent] Nie udało się dodać typu.', error);
    } finally {
      this._saving.set(false);
    }
  }

  /** Usuwa typ ze schematu. Backend odmawia (`TYP-004`), gdy typ jest jeszcze w użyciu —
   * front nie duplikuje tej reguły, tylko pokazuje jej wynik. */
  private async _removeTypeAsync(type: IssueTypeDto): Promise<void> {
    const scheme = this.scheme();

    if (!scheme) {
      return;
    }

    await this._confirm.confirmThenAsync(
      {
        title: PROJECT_KEYS.detail.types.remove.confirmTitle,
        message: PROJECT_KEYS.detail.types.remove.confirmMessage,
        details: [type.name],
      },
      async () => {
        await this._schemes.removeTypeAsync({ uuid: scheme.uuid, typeUuid: type.uuid });
        await this._schemes.searchAsync({}, { autoLoad: true });
      },
    );
  }
}
