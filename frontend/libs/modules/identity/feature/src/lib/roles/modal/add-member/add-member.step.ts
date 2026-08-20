import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpTextComponent } from '@erp/shared/ui';
import { RoleOrchestrator, RoleVM, BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { AddMemberMetadata } from './add-member.definition';
import { ROLES_KEYS } from '../../translation';

/** Krok modalu seryjnego dołączenia roli składowej — picker roli, wspólny dla WSZYSTKICH
 * zaznaczonych ról-kontenerów (tryb `templateCommand`). `excludeUuids` filtruje picker tylko
 * w trybie jednego celu (patrz definicja). */
@Component({
  selector: 'erp-identity-add-member-step',
  standalone: true,
  imports: [CommonModule, TuiIcon, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _roles = targetRoles();

    <div class="add-member-step">
      @if (isFilterMode()) {
        <p class="add-member-step__message">
          <erp-text [config]="{ value: ROLES_KEYS.commands.addMember.editMessage }" />
          <strong> {{ targetCount() }} </strong>
          <erp-text
            [config]="{ value: targetCount() === 1 ? ROLES_KEYS.commands.addMember.roleSuffixSingle : ROLES_KEYS.commands.addMember.roleSuffixPlural }"
          />
          <erp-text [config]="{ value: ROLES_KEYS.commands.addMember.filterModeSuffix }" />
        </p>
        <p class="add-member-step__hint">
          <tui-icon icon="@tui.filter" class="add-member-step__badge-icon" />
          <erp-text [config]="{ value: ROLES_KEYS.commands.addMember.filterModeHint }" />
        </p>
      } @else if (_roles.length > 0) {
        <p class="add-member-step__message">
          <erp-text [config]="{ value: ROLES_KEYS.commands.addMember.editMessage }" />
          <strong> {{ _roles.length }} </strong>
          <erp-text [config]="{ value: _roles.length === 1 ? ROLES_KEYS.commands.addMember.roleSuffixSingle : ROLES_KEYS.commands.addMember.roleSuffixPlural }" />:
        </p>
        <div class="add-member-step__badges">
          @for (r of _roles; track r.uuid) {
            <div class="add-member-step__badge">
              <tui-icon icon="@tui.shield" class="add-member-step__badge-icon" />
              <span>{{ r.name }}</span>
            </div>
          }
        </div>
      }

      <erp-step-content [contentConfig]="formContent" />
    </div>
  `,
  styles: [
    `
      .add-member-step {
        padding: 0.75rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .add-member-step__message {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .add-member-step__hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--tui-text-tertiary);
        font-size: 0.8rem;
      }
      .add-member-step__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        max-height: 8rem;
        overflow-y: auto;
      }
      .add-member-step__badge {
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
      .add-member-step__badge-icon {
        font-size: 0.9rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMemberStepComponent extends ErpBatchStepBase<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, AddMemberMetadata> {
  protected readonly ROLES_KEYS = ROLES_KEYS;

  private readonly _roleOrchestrator: RoleOrchestrator;

  protected readonly targetRoles: Signal<RoleVM[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Patrz komentarz w `AssignRoleStepComponent` — zmienna lokalna zamiast `this.pole`, bo
    // `super()` jeszcze nie wystartował.
    const roleOrchestrator = inject(RoleOrchestrator);
    const availableRoles = computed(() => {
      const exclude = new Set(this.metadata()().excludeUuids);
      return [...roleOrchestrator.getViewModel()().values()].filter((r) => !exclude.has(r.uuid));
    });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'memberRoleUuid',
          'inputPicker',
          (f) => f.setLabel(ROLES_KEYS.commands.addMember.roleLabel).setItems(availableRoles).setLabelKey('name').setValueKey('uuid').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.memberRoleUuid ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, memberRoleUuid: value ?? undefined },
              })),
          },
        ),
    );

    super(config);

    this._roleOrchestrator = roleOrchestrator;
    this.targetRoles = computed(() => {
      const vmMap = this._roleOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined);
    });
    this.formContent = config;
  }
}
