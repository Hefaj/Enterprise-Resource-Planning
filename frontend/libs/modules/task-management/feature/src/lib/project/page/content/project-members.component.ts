import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ErpButtonBuilder, ErpButtonComponent, ErpButtonConfig, ErpInputPickerBuilder, ErpInputPickerComponent, ErpInputPickerConfig, ErpTranslatePipe } from '@erp/shared/ui';
import { ERP_USER_DIRECTORY, ErpUserRef } from '@erp/shared/util';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { PROJECT_MEMBER_ROLE } from '@erp/task-management/util';

import { TaskManagementUserNameComponent } from '../../../user/task-management-user-name.component';
import { taskManagementUserPickerConfig } from '../../../user/task-management-user-picker';
import { PROJECT_KEYS } from '../../translation';

interface RoleOption {
  readonly value: number;
  readonly label: string;
}

/**
 * Zakładka „członkowie" na karcie projektu (`docs/frontend/task-management-pages.md` §4.2).
 *
 * <p><b>To nie jest ekran uprawnień</b> — `project_member` jest atrybutem nadania, nie kodem
 * uprawnienia (`docs/backend/task-management.md` §10.2). Identity odpowiada „czy w ogóle wolno ci
 * ruszać zgłoszenia", ta lista — „w których projektach". Dlatego role są trzy i nie da się ich tu
 * definiować: rozszerzalny zestaw ról per projekt to dokładnie ten katalog uprawnień, który
 * rozsadza się z liczbą działów.</p>
 *
 * <p>Osoby pokazujemy nazwiskiem przez `erp-task-management-user-name`, nie uuidem — katalog
 * użytkowników wchodzi portem `ERP_USER_DIRECTORY` (`docs/frontend/user-directory.md`).</p>
 */
@Component({
  selector: 'erp-task-management-project-members',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule, TaskManagementUserNameComponent],
  template: `
    <section class="flex flex-col gap-4 rounded-md border border-[var(--tui-border-normal)] p-4">
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.members.title | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-tertiary)]">{{ PROJECT_KEYS.detail.members.hint | erpTranslate }}</span>
      </div>

      <div class="flex items-end gap-3">
        <erp-input-picker
          class="w-80"
          [config]="userPickerConfig"
          [control]="userControl"
        />
        <erp-input-picker
          class="w-56"
          [config]="rolePickerConfig()"
          [control]="roleControl"
        />
        <erp-button [config]="addButton" />
      </div>

      @if (members().length === 0) {
        <span class="text-sm text-[var(--tui-text-secondary)]">{{ PROJECT_KEYS.detail.members.empty | erpTranslate }}</span>
      } @else {
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (member of members(); track member.userUuid) {
            <li class="flex items-center gap-3">
              <erp-task-management-user-name
                class="w-64"
                [uuid]="member.userUuid"
              />
              <span class="w-40 text-xs text-[var(--tui-text-secondary)]">{{ roleLabel(member.role) | erpTranslate }}</span>
              <erp-button [config]="removeButton(member.userUuid)" />
            </li>
          }
        </ul>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectMembersComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });
  private readonly _saving = signal(false);
  private readonly _removeButtons = new Map<string, ErpButtonConfig>();

  public readonly project = input.required<ProjectVM>();

  protected readonly members = computed(() => this.project().members ?? []);

  protected readonly userControl = new FormControl<string | null>(null);
  protected readonly roleControl = new FormControl<number | null>(PROJECT_MEMBER_ROLE.Contributor);

  protected readonly userPickerConfig: ErpInputPickerConfig<ErpUserRef, string> = taskManagementUserPickerConfig(this._directory, {
    label: PROJECT_KEYS.detail.members.user,
  });

  protected readonly rolePickerConfig = computed<ErpInputPickerConfig<RoleOption, number>>(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<RoleOption, number>>((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.members.role)
        .setItems(
          computed<RoleOption[]>(() => [
            { value: PROJECT_MEMBER_ROLE.Viewer, label: PROJECT_KEYS.detail.members.roles.viewer },
            { value: PROJECT_MEMBER_ROLE.Contributor, label: PROJECT_KEYS.detail.members.roles.contributor },
            { value: PROJECT_MEMBER_ROLE.Lead, label: PROJECT_KEYS.detail.members.roles.lead },
          ]),
        )
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected readonly addButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.members.add)
      .setAppearance('primary')
      .setLoading(this._saving)
      .setFn(() => this._addAsync()),
  );

  protected roleLabel(role: number | undefined): string {
    switch (role) {
      case PROJECT_MEMBER_ROLE.Lead:
        return PROJECT_KEYS.detail.members.roles.lead;
      case PROJECT_MEMBER_ROLE.Viewer:
        return PROJECT_KEYS.detail.members.roles.viewer;
      default:
        return PROJECT_KEYS.detail.members.roles.contributor;
    }
  }

  /** Konfiguracja przycisku jest cache'owana per użytkownik — inaczej każdy cykl renderowania
   * budowałby nowy obiekt i wybijał `OnPush` z równowagi. */
  protected removeButton(userUuid: string | undefined): ErpButtonConfig {
    const key = userUuid ?? '';
    const existing = this._removeButtons.get(key);
    if (existing) return existing;

    const config = ErpButtonBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.members.remove)
        .setAppearance('flat')
        .setLoading(this._saving)
        .setFn(() => this._removeAsync(key)),
    );
    this._removeButtons.set(key, config);
    return config;
  }

  private async _addAsync(): Promise<void> {
    const userUuid = this.userControl.value;
    if (!userUuid) return;

    this._saving.set(true);
    try {
      await this._projects.addMemberAsync({
        uuid: this.project().uuid,
        userUuid,
        role: this.roleControl.value ?? PROJECT_MEMBER_ROLE.Contributor,
      });
      this.userControl.setValue(null);
    } catch (error) {
      console.error('[ProjectMembersComponent] Nie udało się dodać członka projektu.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _removeAsync(userUuid: string): Promise<void> {
    this._saving.set(true);
    try {
      await this._projects.removeMemberAsync({ uuid: this.project().uuid, userUuid });
    } catch (error) {
      console.error('[ProjectMembersComponent] Nie udało się odebrać członkostwa.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
