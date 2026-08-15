import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  ErpGridLayoutBuilder,
  ErpGridLayoutComponent,
  ErpTabsBuilder,
  ErpTabsComponent,
} from '@erp/shared/ui';
import { JOB_KEYS } from '@erp/notification/ui';
import { JobStore } from './job.store';
import { JobFilterComponent } from './filters/job-filter.component';
import { JobTabComponent } from './tabs/job-tab.component';

/**
 * Strona historii zadań masowych — cel linku „Zobacz wszystkie" z popovera pod dzwonkiem.
 *
 * Zbudowana wg tego samego schematu, co pozostałe strony aplikacji (patrz
 * `catalog/feature/.../product/page/product.component.ts`): store strony w providerach,
 * `ErpGridLayout` jako szkielet, panel filtrów po lewej, pasek akcji z tabelą w treści.
 * Zakładki są tu przełącznikiem widoku (wszystkie / w toku / zakończone) — nie mają
 * własnych komponentów, bo wszystkie trzy pokazują tę samą tabelę, różniącą się filtrem.
 *
 * Scope tłumaczeń `job` przychodzi z trasy (patrz `entry.routes.ts`), nie z dekoratora —
 * providery w komponencie tworzyłyby child injector przesłaniający scope nadrzędny.
 */
@Component({
  selector: 'erp-job',
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [JobStore],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobComponent {
  private readonly _store = inject(JobStore);

  protected readonly activeTabId = signal<string | null>('all');

  protected readonly tabsConfig = ErpTabsBuilder.create(b => b
    .setLayout('horizontal')
    .withSharedState(this.activeTabId)
    .addTab(JOB_KEYS.history.filter.all, 'all', { icon: '@tui.list' })
    .addTab(JOB_KEYS.history.filter.active, 'active', { icon: '@tui.loader' })
    .addTab(JOB_KEYS.history.filter.finished, 'finished', { icon: '@tui.circle-check' })
    .setInitialValue('all')
    .setOnTabChange(tabId => this._store.updateFilters({ isComplete: ISCOMPLETE_BY_TAB[tabId] }))
  );

  protected readonly pageConfig = ErpGridLayoutBuilder.create(b => b
    .setLayoutId('notification-jobs-page')
    .setShowBorders(true)
    .setGrid({
      areas: [
        'filter tabs',
        'filter content',
      ],
      columns: '280px 1fr',
      rows: 'auto 1fr',
      gap: '0',
    })
    .fill('filter', JobFilterComponent)
    .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
    .fill('content', JobTabComponent)
  );
}

/** Zakładka → wartość filtra `isComplete`; `undefined` znaczy „nie filtruj po ukończeniu". */
const ISCOMPLETE_BY_TAB: Record<string, boolean | undefined> = {
  all: undefined,
  active: false,
  finished: true,
};
