import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpBatchTargetItem } from '@erp/shared/ui';
import {
  PermissionCatalogOrchestrator,
  UserOrchestrator,
  BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest,
} from '@erp/identity/data-access';
import { GrantPermissionMetadata } from './grant-permission.definition';
import { USERS_KEYS } from '../../translation';

/** Krok modalu seryjnego nadania uprawnienia — picker kodu uprawnienia + powód, wspólne dla
 * WSZYSTKICH zaznaczonych użytkowników (tryb `templateCommand`). Wzorzec identyczny z
 * `AssignRoleStepComponent`. */
@Component({
  selector: 'erp-identity-grant-permission-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantPermissionStepComponent extends ErpBatchStepBase<
  BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest,
  GrantPermissionMetadata
> {
  private readonly _userOrchestrator: UserOrchestrator;

  /** Zaznaczeni użytkownicy zmapowani na kontrakt podsumowania (`ErpBatchTargetItem`). */
  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Patrz komentarz w `AssignRoleStepComponent` — `super()` jeszcze nie wystartował, więc
    // żaden odczyt `this.pole` (nawet samo pole klasy) nie jest tu legalny; stąd zmienne lokalne
    // zamiast `this._permissionCatalog`/`this._permissions`.
    const permissionCatalog = inject(PermissionCatalogOrchestrator);
    const userOrchestrator = inject(UserOrchestrator);
    const permissions = computed(() => [...permissionCatalog.getViewModel()().values()]);

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addBatchTargetsSummary((s) =>
          s
            .setItems(() => this.targetItems())
            .setTargetCount(() => this.targetCount())
            .setIsFilterMode(() => this.isFilterMode())
            .setMessages({
              messageKey: USERS_KEYS.commands.grantPermission.editMessage,
              suffixSingleKey: USERS_KEYS.commands.grantPermission.userSuffixSingle,
              suffixPluralKey: USERS_KEYS.commands.grantPermission.userSuffixPlural,
              filterModeSuffixKey: USERS_KEYS.commands.grantPermission.filterModeSuffix,
              filterModeHintKey: USERS_KEYS.commands.grantPermission.filterModeHint,
            }),
        )
        .addFormField(
          'permissionCode',
          'inputPicker',
          (f) => f.setLabel(USERS_KEYS.commands.grantPermission.permissionLabel).setItems(permissions).setLabelKey('code').setValueKey('code').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().templateCommand?.permissionCode ?? null,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                templateCommand: { ...cmd.templateCommand, permissionCode: value ?? undefined },
              })),
          },
        )
        .addFormField('reason', 'text', (f) => f.setLabel(USERS_KEYS.commands.grantPermission.reasonLabel).setPlaceholder(USERS_KEYS.commands.grantPermission.reasonPlaceholder), {
          validators: [Validators.required],
          value: () => this.command()().templateCommand?.reason ?? '',
          onChange: (value) =>
            this.command().update((cmd) => ({
              ...cmd,
              templateCommand: { ...cmd.templateCommand, reason: value ?? '' },
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
