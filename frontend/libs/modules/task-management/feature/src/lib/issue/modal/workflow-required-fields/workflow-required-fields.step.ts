import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpModalStepBase,
  ErpTranslatePipe,
  ErpUserPickerComponent,
  ErpUserPickerConfig,
} from '@erp/shared/ui';
import {
  ProjectFieldDto,
  ProjectFieldProfileService,
  ResolutionDto,
  TaskManagementResolutionOrchestrator,
} from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE } from '@erp/task-management/util';

import { WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata } from './workflow-required-fields.definition';
import { ISSUE_KEYS } from '../../translation';

/** Pole brakujące razem z kontrolką formularza — ten sam kształt, co w
 * `IssueCustomFieldsComponent`, bo to ten sam rodzaj pola (`ProjectFieldDto`), tylko zawężony
 * do kodów z `WorkflowRequiredFieldsMetadata.missingFieldCodes`. */
interface MissingFieldControl {
  readonly field: ProjectFieldDto;
  readonly control: FormControl<string | null>;
  readonly inputConfig?: ErpInputConfig;
  readonly pickerConfig?: ErpInputPickerConfig;
  readonly userPickerConfig?: ErpUserPickerConfig;
}

/**
 * Krok modalu WF-004: formularz zbudowany WYŁĄCZNIE z pól, których dziś brakuje na zgłoszeniu
 * (`WorkflowRequiredFieldsMetadata.missingFieldCodes`) — nie z całego profilu projektu jak
 * `IssueCustomFieldsComponent`.
 *
 * <p><b>Nie idzie przez `ErpStepContentBuilder`/`addFormField`.</b> Ten builder składa
 * formularz raz, w konstruktorze, z NAZW pól znanych w chwili budowania konfiguracji — a zbiór
 * brakujących pól jest tu daną z `metadata()`, dostępną dopiero jako sygnał, nie w konstruktorze
 * (`ErpModalStepBase.metadata` to `input.required`, więc odczyt przed pełną inicjalizacją
 * komponentu rzuciłby błąd). Stąd własny szablon i własny `FormGroup`, budowany w `effect()` —
 * dokładnie ten sam wzorzec, co w `IssueCustomFieldsComponent`.</p>
 *
 * <p><b>`resolution` (ISS-007) jest kodem specjalnym</b>: mimo że nazwa w
 * `WorkflowTransitionDto.requiredFields` brzmi tak samo jak dawne pole niestandardowe, od fazy 6
 * jest polem pierwszej klasy (`Issue.resolutionUuid`) — nie wpisem w profilu pól projektu, więc
 * NIGDY nie znajdzie się wśród `ProjectFieldDto` i musi mieć własną kontrolkę, osobno od pętli
 * budującej `controls()`.</p>
 */
@Component({
  selector: 'erp-task-management-workflow-required-fields-step',
  standalone: true,
  imports: [ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ErpUserPickerComponent, ReactiveFormsModule],
  template: `
    <div class="flex flex-col gap-3">
      <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
        {{ ISSUE_KEYS.commands.requiredFields.hint | erpTranslate }}
      </p>

      @for (item of controls(); track item.field.code) {
        @if (item.userPickerConfig) {
          <erp-user-picker [config]="item.userPickerConfig" [control]="item.control" />
        } @else if (item.pickerConfig) {
          <erp-input-picker [config]="item.pickerConfig" [control]="item.control" />
        } @else if (item.inputConfig) {
          <erp-input [config]="item.inputConfig" [formControl]="item.control" />
        }
      }

      @if (showResolution()) {
        <erp-input-picker [config]="resolutionPickerConfig()" [control]="resolutionControl" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowRequiredFieldsStepComponent extends ErpModalStepBase<
  WorkflowRequiredFieldsCommand,
  WorkflowRequiredFieldsMetadata
> {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  protected readonly controls = signal<MissingFieldControl[]>([]);

  protected readonly showResolution = signal<boolean>(false);

  protected readonly resolutionOptions = signal<ResolutionDto[]>([]);

  protected readonly resolutionControl = new FormControl<string | null>(null, { validators: [Validators.required] });

  protected readonly resolutionPickerConfig = signal<ErpInputPickerConfig>(
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(ISSUE_KEYS.commands.requiredFields.resolutionLabel)
        .setItems([])
        .setLabelKey('name')
        .setValueKey('uuid')
        .setStrategy('single'),
    ),
  );

  private readonly _valid = signal<boolean>(false);

  public constructor() {
    // Bez `formConfig` — ten krok nie ma czego przekazać do `ErpStepContentBuilder.bindForm`,
    // bo formularz nie istnieje, dopóki `metadata()` nie powie, których pól brakuje.
    super();

    const fields = inject(ProjectFieldProfileService);
    const resolutions = inject(TaskManagementResolutionOrchestrator);

    // Kontrolki budują się z profilu pól PROJEKTU, zawężonego do kodów z metadanych. Sygnał,
    // nie `computed` — przebudowanie przy każdym odczycie wartości formularza skasowałoby to,
    // co użytkownik właśnie wpisał (ten sam powód, co w `IssueCustomFieldsComponent`).
    effect(() => {
      const metadata = this.metadata()();
      const command = this.command()();
      const projectUuid = metadata?.projectUuid;
      // `resolution` NIGDY nie jest w profilu pól — patrz komentarz przy klasie — więc pętla
      // poniżej nie ma po co go szukać wśród `ProjectFieldDto`.
      const codes = (metadata?.missingFieldCodes ?? []).filter((code) => code !== 'resolution');

      const profile = projectUuid ? fields.fieldsOf(projectUuid)() : [];
      const matched = profile.filter((field) => codes.includes(field.code));

      untracked(() => {
        // Kontrolki przebudowują się tylko, gdy zmienił się ZBIÓR pól — nie przy każdym
        // odczycie `command()` (który sam formularz zmienia przez `onChange` poniżej).
        const currentCodes = this.controls()
          .map((item) => item.field.code)
          .join('|');
        const nextCodes = matched.map((field) => field.code).join('|');

        if (currentCodes !== nextCodes || this.controls().length === 0) {
          this.controls.set(matched.map((field) => this._toControl(field, command.values)));
        }

        this._recomputeValid();
      });
    });

    // Rozwiązanie (ISS-007) — osobny efekt, bo źródło opcji (`TaskManagementResolutionOrchestrator`)
    // nie ma nic wspólnego z profilem pól projektu.
    effect(() => {
      const metadata = this.metadata()();
      const projectUuid = metadata?.projectUuid;
      const needsResolution = (metadata?.missingFieldCodes ?? []).includes('resolution');

      untracked(() => {
        this.showResolution.set(needsResolution);

        if (needsResolution && projectUuid) {
          void this._loadResolutionsAsync(projectUuid, resolutions);
        }

        const current = this.resolutionControl.value;
        const wanted = this.command()().resolutionUuid ?? null;
        if (current !== wanted) {
          this.resolutionControl.setValue(wanted, { emitEvent: false });
        }

        this._recomputeValid();
      });
    });

    this.resolutionControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({ ...cmd, resolutionUuid: value ?? undefined }));
      this._recomputeValid();
    });

    // Rejestruje ważność kroku dopiero, gdy host modalu poda funkcję rejestrującą — Przycisk
    // „Zapisz" zostaje wyłączony, dopóki każde brakujące pole nie ma wartości.
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) {
        register(this._valid.asReadonly());
      }
    });
  }

  private async _loadResolutionsAsync(
    projectUuid: string,
    resolutions: TaskManagementResolutionOrchestrator,
  ): Promise<void> {
    try {
      const list = await resolutions.searchResolutionsAsync({ projectUuid });
      this.resolutionOptions.set(list);
      this.resolutionPickerConfig.set(
        ErpInputPickerBuilder.create((b) =>
          b
            .setLabel(ISSUE_KEYS.commands.requiredFields.resolutionLabel)
            .setItems(list)
            .setLabelKey('name')
            .setValueKey('uuid')
            .setStrategy('single'),
        ),
      );
    } catch (error) {
      console.error('[WorkflowRequiredFieldsStepComponent] Nie udało się pobrać listy rozwiązań.', error);
    }
  }

  private _toControl(field: ProjectFieldDto, values: Record<string, string> | undefined): MissingFieldControl {
    const initial = values?.[field.code] ?? null;
    const control = new FormControl<string | null>(initial, { validators: [Validators.required] });

    control.valueChanges.subscribe((value) => {
      const text = value === null || value === undefined ? '' : String(value).trim();

      this.command().update((cmd) => ({
        ...cmd,
        values: { ...cmd.values, [field.code]: text },
      }));

      this._recomputeValid();
    });

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
        b.setLabel(field.nameKey ?? field.name).setPlaceholder(this._placeholder(field))),
    };
  }

  private _placeholder(field: ProjectFieldDto): string | undefined {
    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Number) {
      return ISSUE_KEYS.commands.requiredFields.numberHint;
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Date) {
      return ISSUE_KEYS.commands.requiredFields.dateHint;
    }

    return undefined;
  }

  private _recomputeValid(): void {
    const items = this.controls();
    const itemsValid = items.every((item) => item.control.valid);
    const resolutionValid = !this.showResolution() || this.resolutionControl.valid;
    const hasAnything = items.length > 0 || this.showResolution();

    this._valid.set(hasAnything && itemsValid && resolutionValid);
  }
}
