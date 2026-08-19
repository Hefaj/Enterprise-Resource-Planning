import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { RoleOrchestrator, UserAssignRoleCommand } from '@erp/identity/data-access';
import { AssignRoleMetadata } from './assign-role.definition';
import { IDENTITY_KEYS } from '../../../translation';

/** Puste pole (opcjonalne) albo dokładnie `RRRR-MM-DD` — bez tego zły wpis dałby `Invalid Date`
 * po cichu wysłaną do API. `erp-input` nie ma trybu 'date' (tylko 'text'/'password'), stąd
 * zwykły tekst z walidacją formatu zamiast dedykowanego pickera. */
function optionalIsoDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : { invalidDate: true };
}

/** Formularz kroku "nadaj rolę" — picker roli (nad pełną listą ról z cache orkiestratora)
 * + opcjonalna data wygaśnięcia. Zbudowany deklaratywnie przez `ErpStepContentBuilder`,
 * bez bazy batchowej — to zwykła, pojedyncza komenda, nie `BatchCommand<...>`. */
@Component({
  selector: 'erp-identity-assign-role-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignRoleStepComponent extends ErpModalStepBase<UserAssignRoleCommand, AssignRoleMetadata> {
  private readonly _roleOrchestrator = inject(RoleOrchestrator);
  protected readonly _roles = computed(() => [...this._roleOrchestrator.getViewModel()().values()]);

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'roleUuid',
          'inputPicker',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.users.commands.assignRole.roleLabel)
              .setItems(this._roles)
              .setLabelKey('name')
              .setValueKey('uuid')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().roleUuid ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, roleUuid: value ?? undefined })),
          },
        )
        .addFormField(
          'expiresAt',
          'text',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.users.commands.assignRole.expiresAtLabel)
              .setPlaceholder(IDENTITY_KEYS.users.commands.assignRole.expiresAtPlaceholder),
          {
            validators: [optionalIsoDateValidator],
            value: () => {
              const expiresAt = this.command()().expiresAt;
              return expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : '';
            },
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                expiresAt: value ? new Date(value) : undefined,
              })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
