import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NotificationJobOrchestrator, JobVM } from '@erp/notification/data-access';
import { ErpListComponent, ErpListBuilder, ErpBaseListComponent } from '@erp/shared/ui';

@Component({
  selector: 'erp-job-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-between p-2 border-b border-surface-200 dark:border-surface-700 w-full">
      <div class="flex flex-col gap-1">
        <span class="font-semibold text-sm text-surface-900 dark:text-surface-100">
          {{ item().trackingId || 'Brak ID' }}
        </span>
        <span class="text-xs text-surface-500 dark:text-surface-400">
          Kolejka: {{ item().queueId || '-' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        @if (item().isComplete) {
          @if (item().exceptions || item().errors) {
            <span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              Błąd
            </span>
          } @else {
            <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Zakończono
            </span>
          }
        } @else {
          <span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            W toku
          </span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobListItemComponent {
  public readonly item = input.required<JobVM>();
}

@Component({
  selector: 'erp-job-list',
  standalone: true,
  imports: [CommonModule, ErpListComponent, ReactiveFormsModule],
  template: `
    <div class="job-list-container p-4 w-full h-full flex flex-col gap-3">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">Lista Zadań (Jobs)</h2>
        @if (isLoading()) {
          <span class="text-xs text-surface-500">Wczytywanie...</span>
        }
      </div>
      
      <erp-list [config]="listConfig()" [control]="control" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobListComponent extends ErpBaseListComponent<JobVM> implements OnInit {
  private readonly _orchestrator = inject(NotificationJobOrchestrator);

  protected readonly jobs = computed(() => {
    return Array.from(this._orchestrator.getViewModel()().values());
  });

  protected readonly isLoading = this._orchestrator.isLoading;

  protected readonly listConfig = computed(() =>
    ErpListBuilder.create<ErpListBuilder<JobVM>>((b) =>
      b
        .setItems(this.jobs)
        .setItemValue((job) => job)
        .setSelectionMode(this.selectionMode())
        .setReadonly(this.readonly())
        .setItemComponent(JobListItemComponent)
        .setScrollHeight('400px')
    )
  );

  public ngOnInit(): void {
    this._orchestrator.searchAsync({
      pageSize: 50
    });
  }
}
