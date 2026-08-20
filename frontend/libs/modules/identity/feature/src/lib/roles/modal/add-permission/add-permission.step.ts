import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpTextComponent } from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, RoleOrchestrator, RoleVM, BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { AddPermissionMetadata } from './add-permission.definition';
import { ROLES_KEYS } from '../../translation';

/** Krok modalu seryjnego dodania uprawnienia — picker kodu uprawnienia, wspólny dla WSZYSTKICH
 * zaznaczonych ról (tryb `templateCommand`). `excludeCodes` (z metadanych) filtruje picker
 * tylko w trybie jednego celu — w trybie wsadowym z listy jest pusty (patrz definicja). */
@Component({
  selector: 'erp-identity-add-permission-step',
  standalone: true,
  imports: [CommonModule, TuiIcon, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _roles = targetRoles();

    <div class="add-permission-step">
      @if (isFilterMode()) {
        <p class="add-permission-step__message">
          <erp-text [config]="{ value: ROLES_KEYS.commands.addPermission.editMessage }" />
          <strong> {{ targetCount() }} </strong>
          <erp-text
            [config]="{
              value: targetCount() === 1 ? ROLES_KEYS.commands.addPermission.roleSuffixSingle : ROLES_KEYS.commands.addPermission.roleSuffixPlural,
            }"
          />
          <erp-text [config]="{ value: ROLES_KEYS.commands.addPermission.filterModeSuffix }" />
        </p>
        <p class="add-permission-step__hint">
          <tui-icon icon="@tui.filter" class="add-permission-step__badge-icon" />
          <erp-text [config]="{ value: ROLES_KEYS.commands.addPermission.filterModeHint }" />
        </p>
      } @else if (_roles.length > 0) {
        <p class="add-permission-step__message">
          <erp-text [config]="{ value: ROLES_KEYS.commands.addPermission.editMessage }" />
          <strong> {{ _roles.length }} </strong>
          <erp-text
            [config]="{ value: _roles.length === 1 ? ROLES_KEYS.commands.addPermission.roleSuffixSingle : ROLES_KEYS.commands.addPermission.roleSuffixPlural }"
          />:
        </p>
        <div class="add-permission-step__badges">
          @for (r of _roles; track r.uuid) {
            <div class="add-permission-step__badge">
              <tui-icon icon="@tui.shield" class="add-permission-step__badge-icon" />
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
      .add-permission-step {
        padding: 0.75rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .add-permission-step__message {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .add-permission-step__hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--tui-text-tertiary);
        font-size: 0.8rem;
      }
      .add-permission-step__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        max-height: 8rem;
        overflow-y: auto;
      }
      .add-permission-step__badge {
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
      .add-permission-step__badge-icon {
        font-size: 0.9rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPermissionStepComponent extends ErpBatchStepBase<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, AddPermissionMetadata> {
  protected readonly ROLES_KEYS = ROLES_KEYS;

  private readonly _roleOrchestrator: RoleOrchestrator;

  protected readonly targetRoles: Signal<RoleVM[]>;

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
    this.targetRoles = computed(() => {
      const vmMap = this._roleOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined);
    });
    this.formContent = config;
  }
}
