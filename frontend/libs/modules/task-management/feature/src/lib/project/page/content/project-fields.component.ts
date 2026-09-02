import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpCheckboxComponent,
  ErpConfirmDialogService,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import {
  FieldSchemeAddFieldCommand,
  FieldSchemeDto,
  FieldDefinitionDto,
  FieldSlotUsageDto,
  ProjectFieldProfileService,
  ProjectVM,
  TaskManagementFieldSchemeOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE, FIELD_SLOT } from '@erp/task-management/util';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka pól na karcie projektu — definicje pól i <b>ich mapowanie na sloty</b>
 * (`docs/frontend/task-management-pages.md` §4.2).
 *
 * <p>Tu żyje ostrzeżenie „slot jest przypisany na stałe", identyczne co do treści z tym przy
 * typach dokumentów w DMS. Nie jest ozdobnikiem: przemapowanie slotu podmieniłoby znaczenie
 * danych historycznych, więc backend nie ma takiej komendy w ogóle
 * (`docs/backend/task-management.md` §6). Użytkownik musi to wiedzieć <b>przed</b> zapisem,
 * bo po nim jedyną drogą jest usunięcie pola — a to blokuje pierwsza zapisana wartość.</p>
 */
@Component({
  selector: 'erp-task-management-project-fields',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpCheckboxComponent,
    ErpInputComponent,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.fields.title | erpTranslate }}</span>

      <div class="flex items-end gap-3">
        <erp-input-picker class="w-80" [config]="schemePickerConfig()" [control]="schemeControl" />
        <erp-button [config]="attachButton" />
      </div>

      <span class="text-xs text-[var(--tui-text-tertiary)]">
        {{ PROJECT_KEYS.detail.fields.scheme.detachHint | erpTranslate }}
      </span>

      @if (this.fields().length === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.fields.scheme.empty | erpTranslate }}
        </span>
      } @else {
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase text-[var(--tui-text-tertiary)]">
            <tr>
              <th class="py-1">{{ PROJECT_KEYS.detail.fields.columns.code | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.fields.columns.name | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.fields.columns.type | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.fields.columns.slot | erpTranslate }}</th>
              <th class="py-1">{{ PROJECT_KEYS.detail.fields.columns.required | erpTranslate }}</th>
              <th class="py-1"></th>
            </tr>
          </thead>
          <tbody>
            @for (field of this.fields(); track field.uuid) {
              <tr class="border-t border-[var(--tui-border-normal)]">
                <td class="py-2 font-mono text-xs">{{ field.code }}</td>
                <td class="py-2">{{ (field.nameKey ?? field.name) | erpTranslate }}</td>
                <td class="py-2">{{ this.typeLabel(field.dataType) | erpTranslate }}</td>
                <td class="py-2 font-mono text-xs">{{ this.slotLabel(field.slot) }}</td>
                <td class="py-2">{{ field.isRequired ? '✓' : '' }}</td>
                <td class="py-2 text-right">
                  <erp-button [config]="this.removeButton(field)" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (this.scheme()) {
        <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
          <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.fields.add.title | erpTranslate }}</span>

          <!-- Ostrzeżenie PRZED formularzem, nie pod przyciskiem zapisu: po zapisie slotu
               nie da się już zmienić, więc informacja po fakcie nie ma czemu służyć. -->
          <span class="text-xs text-[var(--tui-status-warning)]">
            {{ PROJECT_KEYS.detail.fields.slotWarning | erpTranslate }}
          </span>

          @if (this.slotExhaustionMessage(); as message) {
            <span class="text-xs text-[var(--tui-status-negative)]">{{ message }}</span>
          }

          <div class="grid grid-cols-2 gap-3">
            <erp-input [config]="codeInput" [formControl]="codeControl" />
            <erp-input [config]="nameInput" [formControl]="nameControl" />
            <erp-input [config]="nameKeyInput" [formControl]="nameKeyControl" />
            <erp-input-picker [config]="typePickerConfig()" [control]="typeControl" />
            <erp-input-picker [config]="slotPickerConfig()" [control]="slotControl" />
            @if (this.isSelect()) {
              <erp-input [config]="optionsInput" [formControl]="optionsControl" />
            }
            <erp-checkbox [config]="requiredCheckbox" [formControl]="requiredControl" />
          </div>

          <div class="flex justify-end">
            <erp-button [config]="addButton" />
          </div>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFieldsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _schemes = inject(TaskManagementFieldSchemeOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _profiles = inject(ProjectFieldProfileService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _transloco = inject(TranslocoService);
  private readonly _translationsReady = injectTranslationsReadySignal();

  public readonly project = input.required<ProjectVM>();

  private readonly _saving = signal<boolean>(false);

  protected readonly schemeControl = new FormControl<string | null>(null);
  protected readonly codeControl = new FormControl<string | null>(null);
  protected readonly nameControl = new FormControl<string | null>(null);
  protected readonly nameKeyControl = new FormControl<string | null>(null);
  protected readonly typeControl = new FormControl<number | null>(CUSTOM_FIELD_DATA_TYPE.Text);
  protected readonly slotControl = new FormControl<number | null>(FIELD_SLOT.None);
  protected readonly optionsControl = new FormControl<string | null>(null);
  protected readonly requiredControl = new FormControl<boolean>(false);

  /**
   * Wybrany typ danych jako <b>sygnał</b>, nie odczyt z `FormControl`.
   *
   * <p>`computed` liczące pulę slotów musi mieć od czego zależeć. `FormControl.value` sygnałem
   * nie jest, więc odczyt z niego nie tworzy zależności i lista slotów zostawała przy puli
   * z pierwszego renderu — użytkownik wybierał „Liczba", a dostawał sloty tekstowe.</p>
   */
  private readonly _selectedType = signal<number>(CUSTOM_FIELD_DATA_TYPE.Text);

  protected readonly isSelect = computed(() => this._selectedType() === CUSTOM_FIELD_DATA_TYPE.Select);

  /** Schemat podpięty do projektu, ze wszystkimi definicjami. */
  protected readonly scheme = computed<FieldSchemeDto | undefined>(() => {
    const uuid = this.project().fieldSchemeUuid;

    return uuid ? this._schemes.getOne(uuid)() : undefined;
  });

  protected readonly fields = computed<FieldDefinitionDto[]>(() => this.scheme()?.fields ?? []);

  protected readonly schemePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.fields.scheme.label)
        .setPlaceholder(PROJECT_KEYS.detail.fields.scheme.placeholder)
        .setItems([...this._schemes.getViewModel()().values()].map((s) => ({ value: s.uuid, label: s.name })))
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected readonly typePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.fields.add.type)
        .setItems([
          { value: CUSTOM_FIELD_DATA_TYPE.Text, label: this._t(PROJECT_KEYS.detail.fields.types.text) },
          { value: CUSTOM_FIELD_DATA_TYPE.Number, label: this._t(PROJECT_KEYS.detail.fields.types.number) },
          { value: CUSTOM_FIELD_DATA_TYPE.Date, label: this._t(PROJECT_KEYS.detail.fields.types.date) },
          { value: CUSTOM_FIELD_DATA_TYPE.User, label: this._t(PROJECT_KEYS.detail.fields.types.user) },
          { value: CUSTOM_FIELD_DATA_TYPE.Select, label: this._t(PROJECT_KEYS.detail.fields.types.select) },
        ])
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  /**
   * Wolne sloty pasujące do wybranego typu. Zajęte <b>nie są</b> pokazywane jako wyszarzone —
   * slot zajęty to slot nieistniejący z punktu widzenia tego formularza, a lista dostępnych
   * rzeczy nie powinna zawierać niedostępnych.
   */
  protected readonly slotPickerConfig = computed<ErpInputPickerConfig>(() => {
    const taken = new Set(this.fields().map((f) => f.slot));
    const dataType = this._selectedType();

    const items = [
      { value: FIELD_SLOT.None, label: this._t(PROJECT_KEYS.detail.fields.add.slotNone) },
      ...FIELD_SLOT_POOL[this._poolOf(dataType)]
        .filter((slot) => !taken.has(slot))
        .map((slot) => ({ value: slot, label: FIELD_SLOT_NAMES[slot] })),
    ];

    return ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.fields.add.slot)
        .setItems(items)
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    );
  });

  /**
   * Komunikat o wyczerpaniu puli slotów danego typu (`FLD-005`) — mówi, ile jest zajętych
   * i przez jakie pola, żeby użytkownik wiedział, co usunąć, zamiast zgadywać z pustej listy
   * slotów w pickerze powyżej.
   */
  protected readonly slotExhaustionMessage = computed<string | undefined>(() => {
    this._translationsReady();
    const usage: FieldSlotUsageDto | undefined = this._profiles
      .getOne(this.project().uuid)()
      ?.slotUsage?.find((u) => u.dataType === this._selectedType());

    if (!usage || usage.usedSlots < usage.totalSlots) {
      return undefined;
    }

    return this._transloco.translate(PROJECT_KEYS.detail.fields.add.slotsExhausted, {
      used: usage.usedSlots,
      total: usage.totalSlots,
      fields: usage.usedByFieldNames.join(', '),
    });
  });

  protected readonly codeInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.fields.add.code).setHint(PROJECT_KEYS.detail.fields.add.codeHint),
  );

  /** Nazwa jako zwykły tekst (`FLD-002`) — droga domyślna dla pola założonego z UI. Klucz
   * tłumaczenia (poniżej) zostaje opcjonalny: nikt ręcznie zakładający pole nie ma powodu
   * rejestrować go w `translation/*.json`, więc wymaganie klucza pokazywałoby dosłowny,
   * nieprzetłumaczony ciąg każdemu, kto o tym zapomni. */
  protected readonly nameInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.fields.add.name),
  );

  protected readonly nameKeyInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.fields.add.nameKey).setHint(PROJECT_KEYS.detail.fields.add.nameKeyHint),
  );

  protected readonly optionsInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.fields.add.options).setHint(PROJECT_KEYS.detail.fields.add.optionsHint),
  );

  protected readonly requiredCheckbox = { label: PROJECT_KEYS.detail.fields.add.required };

  protected readonly attachButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.fields.scheme.label,
    appearance: 'secondary',
    size: 'm',
    loading: this._saving,
    fn: () => this._attachAsync(),
  };

  protected readonly addButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.fields.add.submit,
    appearance: 'primary',
    size: 'm',
    loading: this._saving,
    fn: () => this._addFieldAsync(),
  };

  public constructor() {
    effect(() => {
      const project = this.project();

      untracked(() => {
        this.schemeControl.setValue(project.fieldSchemeUuid ?? null);
        void this._schemes.searchAsync({}, { autoLoad: true });
      });
    });

    // Zmiana typu unieważnia wybrany slot: pula slotów jest inna dla każdego typu, a slot
    // z poprzedniej puli backend i tak odrzuci (`taskmgmt.field_slot_type_mismatch`).
    this.typeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this._selectedType.set(value ?? CUSTOM_FIELD_DATA_TYPE.Text);
      this.slotControl.setValue(FIELD_SLOT.None);
    });
  }

  protected typeLabel(dataType: number): string {
    switch (dataType) {
      case CUSTOM_FIELD_DATA_TYPE.Number:
        return PROJECT_KEYS.detail.fields.types.number;
      case CUSTOM_FIELD_DATA_TYPE.Date:
        return PROJECT_KEYS.detail.fields.types.date;
      case CUSTOM_FIELD_DATA_TYPE.User:
        return PROJECT_KEYS.detail.fields.types.user;
      case CUSTOM_FIELD_DATA_TYPE.Select:
        return PROJECT_KEYS.detail.fields.types.select;
      default:
        return PROJECT_KEYS.detail.fields.types.text;
    }
  }

  protected slotLabel(slot: number): string {
    return FIELD_SLOT_NAMES[slot] ?? this._t(PROJECT_KEYS.detail.fields.noSlot);
  }

  protected removeButton(field: FieldDefinitionDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.fields.remove.label,
      appearance: 'flat',
      size: 's',
      fn: () => this._removeFieldAsync(field),
    };
  }

  private _poolOf(dataType: number): keyof typeof FIELD_SLOT_POOL {
    switch (dataType) {
      case CUSTOM_FIELD_DATA_TYPE.Number:
        return 'num';
      case CUSTOM_FIELD_DATA_TYPE.Date:
        return 'date';
      case CUSTOM_FIELD_DATA_TYPE.User:
        return 'user';
      default:
        return 'text';
    }
  }

  private _t(key: string): string {
    return this._transloco.translate(key);
  }

  private async _attachAsync(): Promise<void> {
    this._saving.set(true);

    try {
      await this._projects.setFieldSchemeAsync({
        uuid: this.project().uuid,
        fieldSchemeUuid: this.schemeControl.value ?? undefined,
      });

      // Profil pól trzyma osobny cache — bez unieważnienia lista zgłoszeń pokazywałaby
      // kolumny sprzed zmiany aż do przeładowania strony.
      this._profiles.invalidate(this.project().uuid);
    } catch (error) {
      console.error('[ProjectFieldsComponent] Nie udało się podpiąć schematu pól.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _addFieldAsync(): Promise<void> {
    const scheme = this.scheme();
    const code = this.codeControl.value?.trim();

    if (!scheme || !code) {
      return;
    }

    this._saving.set(true);

    try {
      const command: FieldSchemeAddFieldCommand = {
        uuid: scheme.uuid,
        fieldUuid: crypto.randomUUID(),
        code,
        name: this.nameControl.value?.trim() || code,
        nameKey: this.nameKeyControl.value?.trim() || undefined,
        dataType: this._selectedType(),
        slot: this.slotControl.value ?? FIELD_SLOT.None,
        orderNo: this.fields().length,
        isRequired: this.requiredControl.value ?? false,
        options: (this.optionsControl.value ?? '')
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean),
      };

      await this._schemes.addFieldAsync(command);
      await this._schemes.searchAsync({}, { autoLoad: true });
      this._profiles.invalidate(this.project().uuid);

      this.codeControl.reset();
      this.nameControl.reset();
      this.nameKeyControl.reset();
      this.optionsControl.reset();
      this.requiredControl.setValue(false);
      this.slotControl.setValue(FIELD_SLOT.None);
    } catch (error) {
      console.error('[ProjectFieldsComponent] Nie udało się dodać pola.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _removeFieldAsync(field: FieldDefinitionDto): Promise<void> {
    const scheme = this.scheme();

    if (!scheme) {
      return;
    }

    await this._confirm.confirmThenAsync(
      {
        title: PROJECT_KEYS.detail.fields.remove.confirmTitle,
        message: PROJECT_KEYS.detail.fields.remove.confirmMessage,
        details: [field.code],
      },
      async () => {
        await this._schemes.removeFieldAsync({ uuid: scheme.uuid, fieldUuid: field.uuid });
        await this._schemes.searchAsync({}, { autoLoad: true });
        this._profiles.invalidate(this.project().uuid);
      },
    );
  }
}

/** Nazwy slotów tak, jak wyglądają w bazie — użytkownik konfigurujący schemat musi móc
 * skorelować je z kolumną, o której mówi dokumentacja i log zapytania. */
const FIELD_SLOT_NAMES: Record<number, string> = {
  [FIELD_SLOT.Num1]: 'num_1',
  [FIELD_SLOT.Num2]: 'num_2',
  [FIELD_SLOT.Num3]: 'num_3',
  [FIELD_SLOT.Num4]: 'num_4',
  [FIELD_SLOT.Text1]: 'text_1',
  [FIELD_SLOT.Text2]: 'text_2',
  [FIELD_SLOT.Text3]: 'text_3',
  [FIELD_SLOT.Text4]: 'text_4',
  [FIELD_SLOT.Date1]: 'date_1',
  [FIELD_SLOT.Date2]: 'date_2',
  [FIELD_SLOT.Date3]: 'date_3',
  [FIELD_SLOT.Date4]: 'date_4',
  [FIELD_SLOT.User1]: 'user_1',
  [FIELD_SLOT.User2]: 'user_2',
};

/** Pule slotów per typ danych — kopia reguły `FieldSlots.Accepts` z backendu. Rozjazd tutaj
 * kończy się odrzuceniem komendy, nie cichym błędem, ale i tak lepiej go nie mieć. */
const FIELD_SLOT_POOL = {
  num: [FIELD_SLOT.Num1, FIELD_SLOT.Num2, FIELD_SLOT.Num3, FIELD_SLOT.Num4],
  text: [FIELD_SLOT.Text1, FIELD_SLOT.Text2, FIELD_SLOT.Text3, FIELD_SLOT.Text4],
  date: [FIELD_SLOT.Date1, FIELD_SLOT.Date2, FIELD_SLOT.Date3, FIELD_SLOT.Date4],
  user: [FIELD_SLOT.User1, FIELD_SLOT.User2],
} as const;
