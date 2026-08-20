import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import {
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpBatchStepBase,
  ErpTextComponent,
} from '@erp/shared/ui';
import { RoleOrchestrator, UserOrchestrator, UserVM, BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest } from '@erp/identity/data-access';
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
  imports: [CommonModule, TuiIcon, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _users = targetUsers();

    <div class="assign-role-step">
      @if (isFilterMode()) {
        <p class="assign-role-step__message">
          <erp-text [config]="{ value: USERS_KEYS.commands.assignRole.editMessage }" />
          <strong> {{ targetCount() }} </strong>
          <erp-text
            [config]="{
              value: targetCount() === 1 ? USERS_KEYS.commands.assignRole.userSuffixSingle : USERS_KEYS.commands.assignRole.userSuffixPlural,
            }"
          />
          <erp-text [config]="{ value: USERS_KEYS.commands.assignRole.filterModeSuffix }" />
        </p>
        <p class="assign-role-step__hint">
          <tui-icon icon="@tui.filter" class="assign-role-step__badge-icon" />
          <erp-text [config]="{ value: USERS_KEYS.commands.assignRole.filterModeHint }" />
        </p>
      } @else if (_users.length > 0) {
        <p class="assign-role-step__message">
          <erp-text [config]="{ value: USERS_KEYS.commands.assignRole.editMessage }" />
          <strong> {{ _users.length }} </strong>
          <erp-text
            [config]="{ value: _users.length === 1 ? USERS_KEYS.commands.assignRole.userSuffixSingle : USERS_KEYS.commands.assignRole.userSuffixPlural }"
          />:
        </p>
        <div class="assign-role-step__badges">
          @for (u of _users; track u.uuid) {
            <div class="assign-role-step__badge">
              <tui-icon icon="@tui.user" class="assign-role-step__badge-icon" />
              <span>{{ u.email }}</span>
            </div>
          }
        </div>
      }

      <erp-step-content [contentConfig]="formContent" />
    </div>
  `,
  styles: [
    `
      .assign-role-step {
        padding: 0.75rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .assign-role-step__message {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .assign-role-step__hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--tui-text-tertiary);
        font-size: 0.8rem;
      }
      .assign-role-step__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        max-height: 8rem;
        overflow-y: auto;
      }
      .assign-role-step__badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.6rem;
        border-radius: 1rem;
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
        font-size: 0.8rem;
        font-weight: 500;
        border: 1px solid var(--tui-border-normal);
      }
      .assign-role-step__badge-icon {
        font-size: 0.9rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignRoleStepComponent extends ErpBatchStepBase<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, AssignRoleMetadata> {
  protected readonly USERS_KEYS = USERS_KEYS;

  private readonly _userOrchestrator: UserOrchestrator;

  protected readonly targetUsers: Signal<UserVM[]>;

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
    this.targetUsers = computed(() => {
      const vmMap = this._userOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined);
    });
    this.formContent = config;
  }
}
