import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
  ErpUserPickerComponent,
  ErpUserPickerConfig,
} from '@erp/shared/ui';
import {
  IssueVM,
  ProjectFieldDto,
  ProjectFieldProfileService,
  IssueSetCustomFieldsCommand,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE } from '@erp/task-management/util';

import { ISSUE_KEYS } from '../../translation';

/** Pole profilu razem z kontrolką formularza — model dla widoku. */
interface CustomFieldControl {
  readonly field: ProjectFieldDto;
  readonly control: FormControl<string | null>;
  readonly inputConfig?: ErpInputConfig;
  readonly pickerConfig?: ErpInputPickerConfig;
  readonly userPickerConfig?: ErpUserPickerConfig;
}

/**
 * Pola niestandardowe na karcie zgłoszenia.
 *
 * <p><b>Formularz buduje się z profilu projektu</b> (`getProjectFieldProfile`), nigdy ze stałej
 * w komponencie — ten sam profil, z którego backend czyta whitelistę sortowania i z którego
 * lista bierze kolumny (`docs/modules/task-management/domain.md` §6). Projekt bez schematu pól nie
 * pokazuje tej sekcji w ogóle: pusty nagłówek nad niczym jest gorszy niż jego brak.</p>
 *
 * <p>Zapis idzie <b>całą mapą naraz</b>, bo komenda ma człon w liczbie mnogiej: to, co przyszło,
 * jest tym, co zostaje, a pole wyczyszczone znika razem ze swoim slotem
 * (`docs/guides/backend/endpoint-naming.md` §2).</p>
 */
@Component({
  selector: 'erp-task-management-issue-custom-fields',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpInputComponent,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ErpUserPickerComponent,
    ReactiveFormsModule,
  ],
  template: `
    @if (this.controls().length > 0) {
      <section class="flex flex-col gap-3">
        <span class="text-xs uppercase tracking-wide text-[var(--tui-text-tertiary)]">
          {{ ISSUE_KEYS.detail.customFields.label | erpTranslate }}
        </span>

        <div class="flex flex-col gap-3">
          @for (item of this.controls(); track item.field.code) {
            @if (item.userPickerConfig) {
              <erp-user-picker [config]="item.userPickerConfig" [control]="item.control" />
            } @else if (item.pickerConfig) {
              <erp-input-picker [config]="item.pickerConfig" [control]="item.control" />
            } @else if (item.inputConfig) {
              <erp-input [config]="item.inputConfig" [formControl]="item.control" />
            }
          }
        </div>

        <div class="flex justify-end">
          <erp-button [config]="saveButton" />
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueCustomFieldsComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  private readonly _fields = inject(ProjectFieldProfileService);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);

  public readonly issue = input.required<IssueVM>();

  private readonly _saving = signal<boolean>(false);

  protected readonly controls = signal<CustomFieldControl[]>([]);

  protected readonly saveButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.customFields.save,
    appearance: 'primary',
    size: 'm',
    loading: this._saving,
    fn: () => this._saveAsync(),
  };

  public constructor() {
    effect(() => {
      const projectUuid = this.issue().projectUuid;

      if (projectUuid) {
        untracked(() => void this._fields.loadAsync(projectUuid));
      }
    });

    // Kontrolki przebudowują się przy zmianie profilu albo zgłoszenia. Trzymamy je w sygnale,
    // a nie w `computed`: `computed` przeliczyłby je przy każdym odczycie wartości formularza
    // i skasowałby to, co użytkownik właśnie wpisał.
    effect(() => {
      const issue = this.issue();
      const fields = this._fields.fieldsOf(issue.projectUuid)();

      untracked(() => this.controls.set(fields.map((field) => this._toControl(field, issue))));
    });
  }

  private _toControl(field: ProjectFieldDto, issue: IssueVM): CustomFieldControl {
    const value = issue.customFields?.[field.code] ?? null;
    const control = new FormControl<string | null>(value);

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.User) {
      return { field, control, userPickerConfig: { label: field.nameKey ?? field.name } };
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Select) {
      return {
        field,
        control,
        pickerConfig: ErpInputPickerBuilder.create((b) =>
          b
            .setLabel(field.nameKey ?? field.name)
            .setItems(field.options.map((option) => ({ value: option, label: option })))
            .setLabelKey('label')
            .setValueKey('value')
            .setStrategy('single'),
        ),
      };
    }

    return {
      field,
      control,
      inputConfig: ErpInputBuilder.create((b) =>
        b
          // `erp-input` zna tylko `text` i `password` — liczba i data jadą tekstem w postaci
          // kanonicznej (liczba z kropką, data ISO-8601 UTC), bo tak samo jadą po drucie
          // i tak samo waliduje je backend (`task-management.md` §6). Pole liczbowe z własnym
          // typem HTML wymagałoby `erp-input-number`, a wtedy „8.5" i „8,5" zaczęłyby zależeć
          // od ustawień przeglądarki.
          .setLabel(field.nameKey ?? field.name)
          .setPlaceholder(this._placeholder(field)),
      ),
    };
  }

  /** Podpowiedź formatu tam, gdzie postać kanoniczna nie jest oczywista. */
  private _placeholder(field: ProjectFieldDto): string | undefined {
    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Number) {
      return ISSUE_KEYS.detail.customFields.numberHint;
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Date) {
      return ISSUE_KEYS.detail.customFields.dateHint;
    }

    return undefined;
  }

  private async _saveAsync(): Promise<void> {
    this._saving.set(true);

    try {
      const values: Record<string, string> = {};

      for (const item of this.controls()) {
        const raw = item.control.value;
        const text = raw === null || raw === undefined ? '' : String(raw).trim();

        // Pole puste świadomie NIE trafia do mapy: brak klucza znaczy „wyczyść", a pusty ciąg
        // musiałby zostać odrzucony przez walidację pola liczbowego.
        if (text) {
          values[item.field.code] = text;
        }
      }

      const command: IssueSetCustomFieldsCommand = { uuid: this.issue().uuid, values };

      await this._issues.setCustomFieldsAsync(command);
    } catch (error) {
      console.error('[IssueCustomFieldsComponent] Nie udało się zapisać pól niestandardowych.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
