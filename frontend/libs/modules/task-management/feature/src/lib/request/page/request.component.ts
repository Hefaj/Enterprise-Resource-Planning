import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';
import { PROJECT_KIND } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { IssueTabComponent } from '../../issue/page/content/issue-tab.component';
import { IssueFilterComponent } from '../../issue/page/filters/issue-filter.component';
import { ISSUE_LIST_PRESET } from '../../issue/page/issue-list-preset';
import { IssueStore } from '../../issue/page/issue.store';
import { provideIssueTranslations } from '../../issue/translation';

/** Lista zleceń międzydziałowych: ten sam agregat Issue, tylko projekty Intake. */
@Component({
  selector: 'erp-task-management-request',
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [
    { provide: ISSUE_LIST_PRESET, useValue: { filters: { projectKind: PROJECT_KIND.Intake }, stateKey: 'taskmgmt-request-list', label: TASKMANAGEMENT_KEYS.navigation.requests } },
    IssueStore,
    provideIssueTranslations(),
  ],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [':host { display: flex; flex: 1; min-height: 0; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create((builder) =>
    builder.setLayoutId('taskmgmt-requests-page').setShowBorders(true)
      .setGrid({ areas: ['filter content'], columns: '280px 1fr', rows: '1fr', gap: '0' })
      .fill('filter', IssueFilterComponent).fill('content', IssueTabComponent),
  );
}
