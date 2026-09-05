import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { IssueStore } from '../../issue/page/issue.store';
import { IssueTabComponent, IssueTabContext } from '../../issue/page/content/issue-tab.component';
import { provideIssueTranslations } from '../../issue/translation';
import { RequestFilterComponent } from './filters/request-filter.component';
import { provideRequestTranslations, REQUEST_KEYS } from '../translation';

/** Osobny `stateKey`/`menuId` od listy zgłoszeń — inaczej obie strony nadpisywałyby sobie
 * nawzajem szerokości kolumn, sortowanie i stan menu kolumn w preferencjach użytkownika. */
/** „Ustaw projekt" jest ukryte tutaj — przeniosłoby zlecenie do dowolnego projektu, nie tylko
 * Intake, co po cichu zamieniłoby je w zwykłe zgłoszenie i wyprowadziło z tej listy. */
const REQUEST_TAB_CONTEXT: IssueTabContext = {
  stateKey: 'taskmgmt-request-list',
  toolbarMenuId: 'taskmgmt-request-toolbar',
  createLabel: REQUEST_KEYS.submitRequest,
  hiddenActionIds: ['set-project'],
};

/**
 * Strona `/task-management/request` — zlecenia międzydziałowe (faza 5, REQ-002).
 *
 * <p><b>Zlecenie NIE jest osobnym agregatem</b> — to zgłoszenie w projekcie typu
 * `ProjectKind.Intake`, więc strona ponownie wykorzystuje `IssueStore`/`IssueTabComponent`
 * (tabela, pasek akcji, „Nowe zgłoszenie") w całości; jedyna różnica z `/task-management/issue`
 * to `RequestFilterComponent`, który zawęża wybór projektu do rejestrów zleceń i sam wybiera
 * pierwszy dostępny.</p>
 *
 * <p><b>„Odbierz realizację" i „zgłoś zastrzeżenia" celowo nie mają własnych modali</b> — to
 * przejścia stanu na karcie zlecenia (`Do odbioru → Odebrane`, `Do odbioru → Zastrzeżenia`),
 * a automat stanów jest DANĄ (`docs/modules/task-management/domain.md` §2), nie logiką zaszytą we
 * froncie. Osobny modal na każde przejście dublowałby to, co panel pól karty już robi ogólnie
 * dla każdego zgłoszenia.</p>
 */
@Component({
  selector: 'erp-task-management-request',
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [IssueStore, provideIssueTranslations(), provideRequestTranslations()],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('taskmgmt-request-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter content'],
        columns: '280px 1fr',
        rows: '1fr',
        gap: '0',
      })
      .fill('filter', RequestFilterComponent)
      .fill('content', IssueTabComponent, { context: REQUEST_TAB_CONTEXT }),
  );
}
