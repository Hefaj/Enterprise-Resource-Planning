import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ErpButtonComponent, ErpButtonBuilder, ErpButtonConfig, ErpInputNumberBuilder, ErpInputNumberComponent, ErpInputNumberConfig, ErpTranslatePipe } from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';

import { PROJECT_KEYS } from '../../translation';

/** Konfiguracja SLA jest częścią karty projektu: administrator ustawia czas reakcji i realizacji
 * tam, gdzie utrzymuje resztę konfiguracji projektu, bez tworzenia sztucznej strony SLA. */
@Component({
  selector: 'erp-task-management-project-sla',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputNumberComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4 rounded-md border border-[var(--tui-border-normal)] p-4">
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.sla.title | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-tertiary)]">
          {{ PROJECT_KEYS.detail.sla.hint | erpTranslate }}
        </span>
      </div>

      <div class="grid max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
        <erp-input-number
          [config]="responseInput"
          [formControl]="responseControl"
        />
        <erp-input-number
          [config]="resolutionInput"
          [formControl]="resolutionControl"
        />
      </div>

      <div class="flex items-center gap-3">
        <erp-button [config]="saveButton" />
        @if (project().slaPolicy) {
          <erp-button [config]="clearButton" />
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSlaComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _saving = signal(false);

  public readonly project = input.required<ProjectVM>();
  protected readonly responseControl = new FormControl<number | null>(null);
  protected readonly resolutionControl = new FormControl<number | null>(null);

  protected readonly responseInput: ErpInputNumberConfig = ErpInputNumberBuilder.create((builder) =>
    builder.setLabel(PROJECT_KEYS.detail.sla.responseMinutes).setMode('integer').setSign('positive').setMin(1),
  );
  protected readonly resolutionInput: ErpInputNumberConfig = ErpInputNumberBuilder.create((builder) =>
    builder.setLabel(PROJECT_KEYS.detail.sla.resolutionMinutes).setMode('integer').setSign('positive').setMin(1),
  );
  protected readonly saveButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.sla.save)
      .setAppearance('primary')
      .setLoading(this._saving)
      .setFn(() => this._saveAsync()),
  );
  protected readonly clearButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.sla.clear)
      .setAppearance('flat')
      .setLoading(this._saving)
      .setFn(() => this._clearAsync()),
  );

  public constructor() {
    effect(() => {
      const policy = this.project().slaPolicy;
      untracked(() => {
        this.responseControl.setValue(policy?.responseMinutes ?? null, { emitEvent: false });
        this.resolutionControl.setValue(policy?.resolutionMinutes ?? null, { emitEvent: false });
      });
    });
  }

  private async _saveAsync(): Promise<void> {
    const responseMinutes = this.responseControl.value ?? undefined;
    const resolutionMinutes = this.resolutionControl.value ?? undefined;
    if (!responseMinutes && !resolutionMinutes) return;

    this._saving.set(true);
    try {
      await this._projects.setSlaPolicyAsync({ uuid: this.project().uuid, responseMinutes, resolutionMinutes });
    } catch (error) {
      console.error('[ProjectSlaComponent] Nie udało się zapisać polityki SLA.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _clearAsync(): Promise<void> {
    this._saving.set(true);
    try {
      await this._projects.setSlaPolicyAsync({ uuid: this.project().uuid });
    } catch (error) {
      console.error('[ProjectSlaComponent] Nie udało się usunąć polityki SLA.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
