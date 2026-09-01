import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ErpButtonComponent, ErpButtonConfig, ErpCheckboxComponent, ErpInputBuilder, ErpInputComponent, ErpInputConfig, ErpTranslatePipe } from '@erp/shared/ui';
import { ProjectVM, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { SLA_WORKING_DAYS, SLA_WORKING_DAYS_DEFAULT } from '@erp/task-management/util';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka SLA na karcie projektu (faza 5, `SLA-001`) — czas reakcji/realizacji i minimalny
 * kalendarz roboczy (dni + godziny, bez świąt na start, patrz `SlaWorkingDays` na backendzie).
 *
 * <p>Dni robocze idą jako siedem checkboxów złożonych w bitmaskę przy zapisie — ten sam kształt
 * co `Issue.CustomFields`: front nie trzyma flag jako osobnego typu, tylko liczbę.</p>
 */
@Component({
  selector: 'erp-task-management-project-sla',
  standalone: true,
  imports: [ErpButtonComponent, ErpCheckboxComponent, ErpInputComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4">
      <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.sla.title | erpTranslate }}</span>

      <div class="grid grid-cols-2 gap-3">
        <erp-input [config]="responseInput" [formControl]="responseControl" />
        <erp-input [config]="resolutionInput" [formControl]="resolutionControl" />
        <erp-input [config]="startTimeInput" [formControl]="startTimeControl" />
        <erp-input [config]="endTimeInput" [formControl]="endTimeControl" />
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-xs uppercase text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.sla.workingDays | erpTranslate }}
        </span>
        <div class="flex flex-wrap gap-4">
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.monday }" [formControl]="mondayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.tuesday }" [formControl]="tuesdayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.wednesday }" [formControl]="wednesdayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.thursday }" [formControl]="thursdayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.friday }" [formControl]="fridayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.saturday }" [formControl]="saturdayControl" />
          <erp-checkbox [config]="{ label: PROJECT_KEYS.detail.sla.days.sunday }" [formControl]="sundayControl" />
        </div>
      </div>

      <div class="flex justify-end">
        <erp-button [config]="saveButton" />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSlaComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  public readonly project = input.required<ProjectVM>();

  private readonly _saving = signal<boolean>(false);

  protected readonly responseControl = new FormControl<string | null>(null);
  protected readonly resolutionControl = new FormControl<string | null>(null);
  protected readonly startTimeControl = new FormControl<string | null>('08:00');
  protected readonly endTimeControl = new FormControl<string | null>('16:00');

  protected readonly mondayControl = new FormControl<boolean>(true);
  protected readonly tuesdayControl = new FormControl<boolean>(true);
  protected readonly wednesdayControl = new FormControl<boolean>(true);
  protected readonly thursdayControl = new FormControl<boolean>(true);
  protected readonly fridayControl = new FormControl<boolean>(true);
  protected readonly saturdayControl = new FormControl<boolean>(false);
  protected readonly sundayControl = new FormControl<boolean>(false);

  protected readonly responseInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.sla.responseMinutes),
  );

  protected readonly resolutionInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.sla.resolutionMinutes),
  );

  protected readonly startTimeInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.sla.workStartTime).setHint(PROJECT_KEYS.detail.sla.timeHint),
  );

  protected readonly endTimeInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.sla.workEndTime).setHint(PROJECT_KEYS.detail.sla.timeHint),
  );

  protected readonly saveButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.sla.save,
    appearance: 'primary',
    size: 'm',
    loading: this._saving,
    fn: () => this._saveAsync(),
  };

  public constructor() {
    effect(() => {
      const sla = this.project().sla;

      untracked(() => {
        this.responseControl.setValue(sla?.responseMinutes != null ? String(sla.responseMinutes) : null);
        this.resolutionControl.setValue(sla?.resolutionMinutes != null ? String(sla.resolutionMinutes) : null);
        this.startTimeControl.setValue(sla?.workStartTime ?? '08:00');
        this.endTimeControl.setValue(sla?.workEndTime ?? '16:00');

        const workingDays = sla?.workingDays ?? SLA_WORKING_DAYS_DEFAULT;
        this.mondayControl.setValue((workingDays & SLA_WORKING_DAYS.Monday) !== 0);
        this.tuesdayControl.setValue((workingDays & SLA_WORKING_DAYS.Tuesday) !== 0);
        this.wednesdayControl.setValue((workingDays & SLA_WORKING_DAYS.Wednesday) !== 0);
        this.thursdayControl.setValue((workingDays & SLA_WORKING_DAYS.Thursday) !== 0);
        this.fridayControl.setValue((workingDays & SLA_WORKING_DAYS.Friday) !== 0);
        this.saturdayControl.setValue((workingDays & SLA_WORKING_DAYS.Saturday) !== 0);
        this.sundayControl.setValue((workingDays & SLA_WORKING_DAYS.Sunday) !== 0);
      });
    });
  }

  private async _saveAsync(): Promise<void> {
    this._saving.set(true);

    try {
      const workingDays =
        (this.mondayControl.value ? SLA_WORKING_DAYS.Monday : 0) |
        (this.tuesdayControl.value ? SLA_WORKING_DAYS.Tuesday : 0) |
        (this.wednesdayControl.value ? SLA_WORKING_DAYS.Wednesday : 0) |
        (this.thursdayControl.value ? SLA_WORKING_DAYS.Thursday : 0) |
        (this.fridayControl.value ? SLA_WORKING_DAYS.Friday : 0) |
        (this.saturdayControl.value ? SLA_WORKING_DAYS.Saturday : 0) |
        (this.sundayControl.value ? SLA_WORKING_DAYS.Sunday : 0);

      const responseMinutes = Number(this.responseControl.value);
      const resolutionMinutes = Number(this.resolutionControl.value);

      await this._projects.setSlaAsync({
        uuid: this.project().uuid,
        responseMinutes: Number.isFinite(responseMinutes) && this.responseControl.value ? responseMinutes : undefined,
        resolutionMinutes:
          Number.isFinite(resolutionMinutes) && this.resolutionControl.value ? resolutionMinutes : undefined,
        workingDays,
        workStartTime: this.startTimeControl.value ?? undefined,
        workEndTime: this.endTimeControl.value ?? undefined,
      });
    } catch (error) {
      console.error('[ProjectSlaComponent] Nie udało się zapisać SLA.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
