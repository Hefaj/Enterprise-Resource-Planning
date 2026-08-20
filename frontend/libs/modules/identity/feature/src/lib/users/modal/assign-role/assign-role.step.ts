import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import {
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpBatchStepBase,
  ErpBatchTargetItem,
} from '@erp/shared/ui';
import { RoleOrchestrator, UserOrchestrator, BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest } from '@erp/identity/data-access';
import { AssignRoleMetadata } from './assign-role.definition';
import { USERS_KEYS } from '../../translation';

/** Puste pole (opcjonalne) albo dokładnie `RRRR-MM-DD` — bez tego zły wpis dałby `Invalid Date`
 * po cichu wysłaną do API. `erp-input` nie ma trybu 'date' (tylko 'text'/'password'), stąd
 * zwykły tekst z walidacją formatu zamiast dedykowanego pickera. */
function optionalIsoDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : { invalidDate: true };
}

/** Krok modalu seryjnego nadania roli — picker roli (nad pełną listą ról z cache orkiestratora)
 * + opcjonalna data wygaśnięcia, wspólne dla WSZYSTKICH zaznaczonych użytkowników (tryb
 * `templateCommand` kontraktu `BatchCommand`). Tryb celów i blokadę zapisu bez celów obsługuje
 * `ErpBatchStepBase`. */
@Component({
  selector: 'erp-identity-assign-role-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignRoleStepComponent extends ErpBatchStepBase<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, AssignRoleMetadata> {
  private readonly _userOrchestrator: UserOrchestrator;

  /** Zaznaczeni użytkownicy zmapowani na kontrakt podsumowania (`ErpBatchTargetItem`). */
  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Zależności i sygnały użyte przez builder MUSZĄ być zmiennymi lokalnymi, nie polami `this.` —
    // `super()` jeszcze nie wystartował, więc jakikolwiek odczyt `this.cokolwiek` (nawet samo
    // pole klasy, nie tylko metoda) rzuca `ReferenceError: Must call super constructor...`.
    // Domknięcia przekazane jako WARTOŚCI (`value: () => this.command()...`) są bezpieczne — ich
    // ciało wykona się dopiero później, po pełnej konstrukcji; niebezpieczny jest wyłącznie
    // NATYCHMIASTOWY odczyt `this.pole` przekazywany wprost jako argument (np. `.setItems(this._roles)`).
    const roleOrchestrator = inject(RoleOrchestrator);
    const userOrchestrator = inject(UserOrchestrator);
    const roles = computed(() => [...roleOrchestrator.getViewModel()().values()]);

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: USERS_KEYS.commands.assignRole.editMessage,
              suffixSingleKey: USERS_KEYS.commands.assignRole.userSuffixSingle,
              suffixPluralKey: USERS_KEYS.commands.assignRole.userSuffixPlural,
              filterModeSuffixKey: USERS_KEYS.commands.assignRole.filterModeSuffix,
              filterModeHintKey: USERS_KEYS.commands.assignRole.filterModeHint,
            }),
        )
        .addFormField('roleUuid', 'inputPicker', (f) => f.setLabel(USERS_KEYS.commands.assignRole.roleLabel).setItems(roles).setLabelKey('name').setValueKey('uuid').setStrategy('single'), {
          validators: [Validators.required],
          value: () => this.command()().templateCommand?.roleUuid ?? null,
          onChange: (value) =>
            this.command().update((cmd) => ({
              ...cmd,
              templateCommand: { ...cmd.templateCommand, roleUuid: value ?? undefined },
            })),
        })
        .addFormField('expiresAt', 'text', (f) => f.setLabel(USERS_KEYS.commands.assignRole.expiresAtLabel).setPlaceholder(USERS_KEYS.commands.assignRole.expiresAtPlaceholder), {
          validators: [optionalIsoDateValidator],
          value: () => {
            const expiresAt = this.command()().templateCommand?.expiresAt;
            return expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : '';
          },
          onChange: (value) =>
            this.command().update((cmd) => ({
              ...cmd,
              templateCommand: { ...cmd.templateCommand, expiresAt: value ? new Date(value) : undefined },
            })),
        }),
    );

    super(config);

    this._userOrchestrator = userOrchestrator;
    this.targetItems = computed(() => {
      const vmMap = this._userOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined)
        .map((vm) => ({ uuid: vm.uuid, label: vm.email }));
    });
    this.formContent = config;
  }
}
