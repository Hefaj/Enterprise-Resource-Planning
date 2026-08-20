import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { TuiIcon } from '@taiga-ui/core';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpBatchStepBase, ErpTextComponent } from '@erp/shared/ui';
import {
  PermissionCatalogOrchestrator,
  UserOrchestrator,
  UserVM,
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
  imports: [CommonModule, TuiIcon, ErpStepContentComponent, ErpTextComponent],
  template: `
    @let _users = targetUsers();

    <div class="grant-permission-step">
      @if (isFilterMode()) {
        <p class="grant-permission-step__message">
          <erp-text [config]="{ value: USERS_KEYS.commands.grantPermission.editMessage }" />
          <strong> {{ targetCount() }} </strong>
          <erp-text
            [config]="{
              value: targetCount() === 1 ? USERS_KEYS.commands.grantPermission.userSuffixSingle : USERS_KEYS.commands.grantPermission.userSuffixPlural,
            }"
          />
          <erp-text [config]="{ value: USERS_KEYS.commands.grantPermission.filterModeSuffix }" />
        </p>
        <p class="grant-permission-step__hint">
          <tui-icon icon="@tui.filter" class="grant-permission-step__badge-icon" />
          <erp-text [config]="{ value: USERS_KEYS.commands.grantPermission.filterModeHint }" />
        </p>
      } @else if (_users.length > 0) {
        <p class="grant-permission-step__message">
          <erp-text [config]="{ value: USERS_KEYS.commands.grantPermission.editMessage }" />
          <strong> {{ _users.length }} </strong>
          <erp-text
            [config]="{
              value: _users.length === 1 ? USERS_KEYS.commands.grantPermission.userSuffixSingle : USERS_KEYS.commands.grantPermission.userSuffixPlural,
            }"
          />:
        </p>
        <div class="grant-permission-step__badges">
          @for (u of _users; track u.uuid) {
            <div class="grant-permission-step__badge">
              <tui-icon icon="@tui.user" class="grant-permission-step__badge-icon" />
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
      .grant-permission-step {
        padding: 0.75rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .grant-permission-step__message {
        margin: 0;
        color: var(--tui-text-secondary);
      }
      .grant-permission-step__hint {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--tui-text-tertiary);
        font-size: 0.8rem;
      }
      .grant-permission-step__badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        max-height: 8rem;
        overflow-y: auto;
      }
      .grant-permission-step__badge {
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
      .grant-permission-step__badge-icon {
        font-size: 0.9rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantPermissionStepComponent extends ErpBatchStepBase<
  BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest,
  GrantPermissionMetadata
> {
  protected readonly USERS_KEYS = USERS_KEYS;

  private readonly _userOrchestrator: UserOrchestrator;

  protected readonly targetUsers: Signal<UserVM[]>;

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
    this.targetUsers = computed(() => {
      const vmMap = this._userOrchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined);
    });
    this.formContent = config;
  }
}
