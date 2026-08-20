import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpBatchTargetItem } from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, RoleOrchestrator, BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { AddPermissionMetadata } from './add-permission.definition';
import { ROLES_KEYS } from '../../translation';

/** Krok modalu seryjnego dodania uprawnienia — picker kodu uprawnienia, wspólny dla WSZYSTKICH
 * zaznaczonych ról (tryb `templateCommand`). `excludeCodes` (z metadanych) filtruje picker
 * tylko w trybie jednego celu — w trybie wsadowym z listy jest pusty (patrz definicja). */
@Component({
  selector: 'erp-identity-add-permission-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPermissionStepComponent extends ErpBatchStepBase<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, AddPermissionMetadata> {
  private readonly _roleOrchestrator: RoleOrchestrator;

  /** Zaznaczone role zmapowane na kontrakt podsumowania (`ErpBatchTargetItem`). */
  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Patrz komentarz w `AssignRoleStepComponent` — zmienne lokalne zamiast `this.pole`, bo
    // `super()` jeszcze nie wystartował. `this.metadata()` WEWNĄTRZ ciała `computed(...)` jest
    // bezpieczne (domknięcie wykona się dopiero po konstrukcji) — niebezpieczny byłby tylko
    // odczyt `this._availablePermissions` jako gotowej wartości przekazanej wprost do `.setItems`.
    const permissionCatalog = inject(PermissionCatalogOrchestrator);
    const roleOrchestrator = inject(RoleOrchestrator);
    const availablePermissions = computed(() => {
      const exclude = new Set(this.metadata()().excludeCodes);
      return [...permissionCatalog.getViewModel()().values()].filter((p) => !exclude.has(p.code));
    });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: ROLES_KEYS.commands.addPermission.editMessage,
              suffixSingleKey: ROLES_KEYS.commands.addPermission.roleSuffixSingle,
              suffixPluralKey: ROLES_KEYS.commands.addPermission.roleSuffixPlural,
              filterModeSuffixKey: ROLES_KEYS.commands.addPermission.filterModeSuffix,
              filterModeHintKey: ROLES_KEYS.commands.addPermission.filterModeHint,
            }),
        )
        .addFormField(
          'permissionCode',
          'inputPicker',
          (f) => f.setLabel(ROLES_KEYS.commands.addPermission.permissionLabel).setItems(availablePermissions).setLabelKey('code').setValueKey('code').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.permissionCode ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, permissionCode: value ?? undefined },
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
