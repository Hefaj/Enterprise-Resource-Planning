import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ProjectVM } from '@erp/task-management/data-access';

import { TaskManagementProjectTableComponent } from '../../components/tables/task-management-project-table/task-management-project-table.component';
import { ProjectStore } from '../project.store';

/** Zawartość strony listy projektów: sama tabela. Toolbara akcji nie ma, bo konfiguracja
 * projektu dzieje się na jego karcie, nie na zaznaczeniu z listy. */
@Component({
  selector: 'erp-task-management-project-tab',
  standalone: true,
  imports: [TaskManagementProjectTableComponent],
  template: `
    <erp-task-management-project-table
      class="block h-full w-full"
      [filters]="store.filters()"
      (loadingChange)="store.setLoading($event)"
      (rowActivated)="this.openCard($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabComponent {
  protected readonly store = inject(ProjectStore);

  private readonly _router = inject(Router);

  protected openCard(project: ProjectVM): void {
    void this._router.navigate(['/task-management/project', project.uuid]);
  }
}
