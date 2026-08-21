import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpBatchTargetItem } from '@erp/shared/ui';
import { RoleOrchestrator, BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { RoleAddMemberMetadata } from './role-add-member.definition';
import { ROLES_KEYS } from '../../translation';

/** Krok modalu seryjnego dołączenia roli składowej — picker roli, wspólny dla WSZYSTKICH
 * zaznaczonych ról-kontenerów (tryb `templateCommand`). `excludeUuids` filtruje picker tylko
 * w trybie jednego celu (patrz definicja). */
@Component({
  selector: 'erp-identity-role-add-member-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleAddMemberStepComponent extends ErpBatchStepBase<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, RoleAddMemberMetadata> {
  private readonly _roleOrchestrator: RoleOrchestrator;

  /** Zaznaczone role zmapowane na kontrakt podsumowania (`ErpBatchTargetItem`). */
  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Patrz komentarz w `UserAssignRoleStepComponent` — zmienna lokalna zamiast `this.pole`, bo
    // `super()` jeszcze nie wystartował.
    const roleOrchestrator = inject(RoleOrchestrator);
    const availableRoles = computed(() => {
      const exclude = new Set(this.metadata()().excludeUuids);
      return [...roleOrchestrator.getViewModel()().values()].filter((r) => !exclude.has(r.uuid));
    });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            // Getter, nie odczyt `this.pole` wprost — `super()` jeszcze nie wystartował.
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: ROLES_KEYS.commands.addMember.editMessage,
              suffixSingleKey: ROLES_KEYS.commands.addMember.roleSuffixSingle,
              suffixPluralKey: ROLES_KEYS.commands.addMember.roleSuffixPlural,
              filterModeSuffixKey: ROLES_KEYS.commands.addMember.filterModeSuffix,
              filterModeHintKey: ROLES_KEYS.commands.addMember.filterModeHint,
            }),
        )
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
    this.targetItems = computed(() => {
      const vmMap = this._roleOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined)
        .map((vm) => ({ uuid: vm.uuid, label: vm.name }));
    });
    this.formContent = config;
  }
}
