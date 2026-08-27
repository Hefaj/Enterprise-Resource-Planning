import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { IssueStore } from './issue.store';
import { IssueFilterComponent } from './filters/issue-filter.component';
import { IssueTabComponent } from './content/issue-tab.component';
import { provideIssueTranslations } from '../translation';

/**
 * Strona `/task-management/issue` — lista zgłoszeń.
 *
 * <p><b>Bez zakładek i bez prawego panelu</b>, bo faza 0 nie ma jeszcze żadnej treści zależnej
 * od zaznaczenia: komentarze i historia wiszą przy zgłoszeniu i mieszkają na jego karcie, a nie
 * w panelu obok listy. Zgodnie z `docs/frontend/pages.md` §3 nie dokładamy `ErpTabsBuilder`
 * ani obszarów `tabs`/`rightPanel`, dopóki nie ma czego w nich pokazać.</p>
 */
@Component({
  selector: 'erp-task-management-issue',
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [IssueStore, provideIssueTranslations()],
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
export class IssueComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('taskmgmt-issues-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter content'],
        columns: '280px 1fr',
        rows: '1fr',
        gap: '0',
      })
      .fill('filter', IssueFilterComponent)
      .fill('content', IssueTabComponent),
  );
}
