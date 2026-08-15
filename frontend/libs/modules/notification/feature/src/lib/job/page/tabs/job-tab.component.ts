import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
} from '@erp/shared/ui';
import { JobService } from '@erp/shared/data-access';
import { JOB_KEYS } from '@erp/notification/ui';
import { NotificationJobTableComponent } from '../../components/notification-job-table/notification-job-table.component';
import { JobStore } from '../job.store';

/**
 * Główna treść strony zadań: pasek akcji nad tabelą historii.
 *
 * Pasek jest celowo krótki — zadanie jest rekordem tylko do odczytu, a jedyne operacje,
 * jakie front dziś na nim potrafi wykonać, są lokalne (odświeżenie widoku, sprzątnięcie
 * feedu). Anulowanie i ponowienie nieudanych elementów należą do modułu-właściciela
 * zadania, nie do Notification, więc nie ma tu dla nich przycisku-atrapy.
 */
@Component({
  selector: 'erp-job-tab',
  standalone: true,
  imports: [
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    NotificationJobTableComponent,
  ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="actionToolbar">
        <erp-action-toolbar [config]="actionToolbar" />
        <div class="flex-1 overflow-hidden">
          <erp-notification-job-table
            stateKey="job-history-main"
            [filters]="currentFilters()"
            (loadingChange)="store.setLoading($event)"
            class="block h-full"
          />
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobTabComponent {
  protected readonly store = inject(JobStore);
  private readonly _jobService = inject(JobService);

  private readonly _table = viewChild(NotificationJobTableComponent);

  protected readonly currentFilters = this.store.filters;

  protected readonly actionToolbar = ErpActionToolbarBuilder.create(b => b
    .setMenuId('job-tab-toolbar')
    .addDefaultGroup(g => g
      .setId('feed')
      .setLabel(JOB_KEYS.page.toolbar.group)
      .setIcon('@tui.layers')
      .addAction(a => a
        .setId('refresh')
        .setLabel(JOB_KEYS.page.toolbar.refresh)
        .setIcon('@tui.refresh-cw')
        .setAppearance('info')
        .setFn(() => this._table()?.reload())
      )
      .addAction(a => a
        .setId('clear-finished')
        .setLabel(JOB_KEYS.page.toolbar.clearFinished)
        // Czyści wyłącznie lokalny feed (dzwonek w nagłówku) — historia na serwerze zostaje,
        // więc tabela poniżej pokazuje te zadania dalej.
        .setIcon('@tui.eraser')
        .setFn(() => this._jobService.clearFinished())
      )
    )
    .setPinnedActionIds(['refresh'])
    .setEnableContextMenu(true)
  );
}
