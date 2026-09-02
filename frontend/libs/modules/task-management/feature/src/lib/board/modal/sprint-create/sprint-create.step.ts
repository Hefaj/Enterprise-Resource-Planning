import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

import { ErpModalStepBase, ErpStepContentBuilder, ErpStepContentComponent, ErpStepContentConfig } from '@erp/shared/ui';
import { SprintCreateCommand } from '@erp/task-management/data-access';

import { SprintCreateMetadata } from './sprint-create.definition';
import { BOARD_KEYS } from '../../translation';

/** Puste pole (opcjonalne) albo dokładnie `RRRR-MM-DD` — ten sam walidator, co przy terminie
 * zgłoszenia (`IssueCreateStepComponent`). */
function optionalIsoDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : { invalidDate: true };
}

/** Krok modalu utworzenia sprintu: nazwa, cel, zakres dat. */
@Component({
  selector: 'erp-task-management-sprint-create-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintCreateStepComponent extends ErpModalStepBase<SprintCreateCommand, SprintCreateMetadata> {
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'name',
          'text',
          (f) => f.setLabel(BOARD_KEYS.backlog.create.name),
          {
            validators: [Validators.required, Validators.maxLength(256)],
            value: () => this.command()().name ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, name: value ?? '' })),
          },
        )
        .addFormField('goal', 'text', (f) => f.setLabel(BOARD_KEYS.backlog.create.goal), {
          value: () => this.command()().goal ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, goal: value || undefined })),
        })
        .addFormField(
          'startsOn',
          'text',
          (f) => f.setLabel(BOARD_KEYS.backlog.create.startsOn),
          {
            validators: [optionalIsoDateValidator],
            value: () => {
              const startsOn = this.command()().startsOn;
              return startsOn ? new Date(startsOn).toISOString().slice(0, 10) : '';
            },
            // `startsOn`/`endsOn` są `DateOnly` po stronie backendu — konwerter JSON wbudowany
            // w .NET akceptuje WYŁĄCZNIE „yyyy-MM-dd", nie pełny znacznik czasu. `new Date(value)`
            // serializowałby się przez `toISOString()` do „…T00:00:00.000Z" i backend odrzucałby
            // to jako 400 (`The JSON value is not in a supported DateOnly format`) — stąd rzutowanie
            // surowego stringa zamiast obiektu `Date` (znaleziony i naprawiony przy weryfikacji 6.4).
            onChange: (value) =>
              this.command().update((cmd) => ({ ...cmd, startsOn: value ? (value as unknown as Date) : undefined })),
          },
        )
        .addFormField(
          'endsOn',
          'text',
          (f) => f.setLabel(BOARD_KEYS.backlog.create.endsOn),
          {
            validators: [optionalIsoDateValidator],
            value: () => {
              const endsOn = this.command()().endsOn;
              return endsOn ? new Date(endsOn).toISOString().slice(0, 10) : '';
            },
            // Patrz komentarz przy `startsOn` wyżej — ten sam powód, ta sama naprawa.
            onChange: (value) =>
              this.command().update((cmd) => ({ ...cmd, endsOn: value ? (value as unknown as Date) : undefined })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
