import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { ProjectFilterComponent } from './filters/project-filter.component';
import { ProjectTabComponent } from './content/project-tab.component';
import { ProjectStore } from './project.store';
import { provideProjectTranslations } from '../translation';

/**
 * Strona `/task-management/project` — lista projektów.
 *
 * <p><b>Osobna strona, mimo że projekt jest przede wszystkim kontekstem listy zgłoszeń.</b>
 * Konfiguracja (pola, schemat stanów, członkowie) nie mieści się w przełączniku nad tabelą,
 * a wejście na kartę projektu musi mieć skąd nastąpić
 * (`docs/modules/task-management/screens.md` §4.1).</p>
 */
@Component({
  selector: 'erp-task-management-project',
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [ProjectStore, provideProjectTranslations()],
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
export class ProjectComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('taskmgmt-projects-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter content'],
        columns: '280px 1fr',
        rows: '1fr',
        gap: '0',
      })
      .fill('filter', ProjectFilterComponent)
      .fill('content', ProjectTabComponent),
  );
}
