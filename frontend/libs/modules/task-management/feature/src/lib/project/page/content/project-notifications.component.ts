import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ErpCheckboxComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka „Powiadomienia" na karcie projektu (NTF-003) — wyciszenie powiadomień z tego
 * projektu, ustawienie **osobiste**: każdy wycisza dla siebie, nie ma tu nic do zarządzania
 * cudzym ustawieniem.
 *
 * <p>Zapis natychmiastowy po zmianie stanu checkboxa, bez osobnego przycisku „Zapisz" — ten sam
 * UX co przełącznik „obserwuję" na karcie zgłoszenia (`IssueDetailComponent.watchButton`).</p>
 *
 * <p><b>Wyjątek wzmianek</b>: wyciszenie tłumi wszystko OPRÓCZ bezpośrednich wzmianek `@`
 * (`taskmgmt.issue.mentioned`) — filtr stosuje `IssueNotificationPublisher` na backendzie, front
 * tylko o tym informuje w podpowiedzi pod checkboxem.</p>
 */
@Component({
  selector: 'erp-task-management-project-notifications',
  standalone: true,
  imports: [ErpCheckboxComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4">
      <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.notifications.title | erpTranslate }}</span>

      <erp-checkbox
        [config]="{ label: PROJECT_KEYS.detail.notifications.muteLabel, hint: PROJECT_KEYS.detail.notifications.muteHint }"
        [formControl]="mutedControl"
      />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectNotificationsComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  public readonly project = input.required<ProjectVM>();

  protected readonly mutedControl = new FormControl<boolean>(false, { nonNullable: true });

  public constructor() {
    effect(() => {
      const muted = this.project().isNotificationMutedByMe;

      untracked(() => this.mutedControl.setValue(muted, { emitEvent: false }));
    });

    this.mutedControl.valueChanges.subscribe((muted) => void this._saveAsync(muted));
  }

  private async _saveAsync(muted: boolean): Promise<void> {
    try {
      await this._projects.setNotificationMutedAsync({ uuid: this.project().uuid, muted });
    } catch (error) {
      console.error('[ProjectNotificationsComponent] Nie udało się zapisać ustawienia powiadomień.', error);
      // Wycofanie checkboxa do stanu sprzed nieudanej zmiany — bez tego UI kłamie o tym,
      // co faktycznie zapisano.
      this.mutedControl.setValue(!muted, { emitEvent: false });
    }
  }
}
