import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpModalStepBase,
  ErpStepContentBuilder,
  ErpStepContentComponent,
  ErpStepContentConfig,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import {
  IssueCreateCommand,
  TaskManagementIssueTypeSchemeOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_PRIORITY } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { IssueCreateMetadata } from './issue-create.definition';
import { ISSUE_KEYS } from '../../translation';

/** Puste pole (opcjonalne) albo dokładnie `RRRR-MM-DD` — bez tego zły wpis dałby `Invalid Date`
 * po cichu wysłaną do API. Ten sam walidator co przy dacie wygaśnięcia nadania w Identity. */
function optionalIsoDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : { invalidDate: true };
}

/**
 * Krok modalu tworzenia zgłoszenia: projekt, tytuł, opis, priorytet, termin.
 *
 * <p>Projekt jest wymagany, bo to on wyznacza licznik klucza i schemat stanów — zgłoszenie
 * bez projektu nie ma jak dostać ani jednego, ani drugiego.</p>
 */
@Component({
  selector: 'erp-task-management-issue-create-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueCreateStepComponent extends ErpModalStepBase<IssueCreateCommand, IssueCreateMetadata> {
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // Zależności i sygnały MUSZĄ być zmiennymi lokalnymi — `super()` jeszcze nie wystartował,
    // więc jakikolwiek NATYCHMIASTOWY odczyt `this.pole` rzuca `ReferenceError`. Domknięcia
    // (`value: () => this...`) są bezpieczne, bo ich ciało wykona się po konstrukcji.
    const projects = inject(TaskManagementProjectOrchestrator);
    const typeSchemes = inject(TaskManagementIssueTypeSchemeOrchestrator);
    const transloco = inject(TranslocoService);
    const translationsReady = injectTranslationsReadySignal();

    // PRJ-004 AC1 — projekt zarchiwizowany znika z pickera tworzenia zgłoszenia. Filtr tutaj,
    // nie na poziomie zapytania: `getViewModel()` czyta WSPÓLNY cache orkiestratora, do którego
    // inne miejsca (np. kolumna „Projekt" na liście zgłoszeń, rozwiązująca `MKT-4` mimo że MKT
    // jest już zarchiwizowany — linki do istniejących zgłoszeń MUSZĄ dalej działać) doładowują
    // projekty PO UUID, bez względu na archiwizację.
    const projectOptions = computed(() =>
      [...projects.getViewModel()().values()]
        .filter((project) => !project.isArchived)
        .map((project) => ({
          uuid: project.uuid,
          label: `${project.code} — ${project.name}`,
        })),
    );

    // Typ zawężony do schematu PODPIĘTEGO DO WYBRANEGO PROJEKTU (`ProjectDto.issueTypeSchemeUuid`)
    // — bez wybranego projektu (albo zanim jego schemat dojedzie do cache) lista jest pusta,
    // bo wybór typu poza schematem projektu i tak odrzuciłby backend (`Issue.SetType`).
    const typeOptions = computed(() => {
      const projectUuid = this.command()().projectUuid;
      const project = projectUuid ? projects.getViewModel()().get(projectUuid) : undefined;
      const scheme = project?.issueTypeSchemeUuid ? typeSchemes.getOne(project.issueTypeSchemeUuid)() : undefined;

      return (scheme?.types ?? []).map((type) => ({ uuid: type.uuid, label: type.name }));
    });

    const priorityOptions = computed(() => {
      translationsReady();
      return [
        { value: ISSUE_PRIORITY.Critical, label: transloco.translate(TASKMANAGEMENT_KEYS.priority.critical) },
        { value: ISSUE_PRIORITY.High, label: transloco.translate(TASKMANAGEMENT_KEYS.priority.high) },
        { value: ISSUE_PRIORITY.Normal, label: transloco.translate(TASKMANAGEMENT_KEYS.priority.normal) },
        { value: ISSUE_PRIORITY.Low, label: transloco.translate(TASKMANAGEMENT_KEYS.priority.low) },
        { value: ISSUE_PRIORITY.Lowest, label: transloco.translate(TASKMANAGEMENT_KEYS.priority.lowest) },
      ];
    });

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'projectUuid',
          'inputPicker',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.create.projectLabel)
              .setItems(projectOptions)
              .setLabelKey('label')
              .setValueKey('uuid')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().projectUuid ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, projectUuid: value ?? undefined })),
          },
        )
        .addFormField(
          'typeUuid',
          'inputPicker',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.create.typeLabel)
              .setItems(typeOptions)
              .setLabelKey('label')
              .setValueKey('uuid')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().typeUuid ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, typeUuid: value ?? undefined })),
          },
        )
        .addFormField(
          'title',
          'text',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.create.titleLabel)
              .setPlaceholder(ISSUE_KEYS.commands.create.titlePlaceholder),
          {
            validators: [Validators.required, Validators.maxLength(512)],
            value: () => this.command()().title ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, title: value ?? '' })),
          },
        )
        .addFormField(
          'description',
          'text',
          (f) => f.setLabel(ISSUE_KEYS.commands.create.descriptionLabel),
          {
            value: () => this.command()().description ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, description: value || undefined })),
          },
        )
        .addFormField(
          'priority',
          'inputPicker',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.create.priorityLabel)
              .setItems(priorityOptions)
              .setLabelKey('label')
              .setValueKey('value')
              .setStrategy('single'),
          {
            value: () => this.command()().priority ?? ISSUE_PRIORITY.Normal,
            onChange: (value) =>
              this.command().update((cmd) => ({ ...cmd, priority: value ?? ISSUE_PRIORITY.Normal })),
          },
        )
        .addFormField(
          'dueAt',
          'text',
          (f) =>
            f
              .setLabel(ISSUE_KEYS.commands.create.dueAtLabel)
              .setPlaceholder(ISSUE_KEYS.commands.create.dueAtPlaceholder),
          {
            validators: [optionalIsoDateValidator],
            value: () => {
              const dueAt = this.command()().dueAt;
              return dueAt ? new Date(dueAt).toISOString().slice(0, 10) : '';
            },
            onChange: (value) =>
              this.command().update((cmd) => ({ ...cmd, dueAt: value ? new Date(value) : undefined })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
