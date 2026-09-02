import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import { ErpModalStepBase, ErpStepContentBuilder, ErpStepContentComponent, ErpStepContentConfig } from '@erp/shared/ui';
import { SprintExecCloseCommand } from '@erp/task-management/data-access';

import { SprintExecCloseMetadata } from './sprint-exec-close.definition';
import { BOARD_KEYS } from '../../translation';

/** Sentinel dla „do backlogu" — `moveUnfinishedToSprintUuid` puste znaczy to samo, ale
 * `inputPicker` potrzebuje wartości odróżnialnej od „nic nie wybrano". */
const BACKLOG_OPTION_VALUE = '__backlog__';

/** Krok modalu zamknięcia sprintu: jeden wybór — dokąd trafiają niedokończone zgłoszenia. */
@Component({
  selector: 'erp-task-management-sprint-exec-close-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintExecCloseStepComponent extends ErpModalStepBase<SprintExecCloseCommand, SprintExecCloseMetadata> {
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // `inputPicker` pokazuje `label` jako gotowy tekst, nie klucz — w odróżnieniu od pól
    // typu 'text'/'inputPicker' obsługiwanych przez `erp-filter`, ten builder nie przepuszcza
    // etykiet przez `erpTranslate` sam. Bez jawnego `translate()` opcja „do backlogu” renderowała
    // się jako surowy klucz `board.backlog.close.toBacklog` (wykryte przy pierwszej żywej
    // weryfikacji tego modalu, sprint.name obok niej nie jest kluczem, więc nie ujawniało tego
    // wcześniej).
    const transloco = inject(TranslocoService);

    const options = computed(() => [
      { uuid: BACKLOG_OPTION_VALUE, label: transloco.translate(BOARD_KEYS.backlog.close.toBacklog) },
      ...this.metadata()().candidateSprints.map((sprint) => ({ uuid: sprint.uuid, label: sprint.name })),
    ]);

    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'moveUnfinishedToSprintUuid',
          'inputPicker',
          (f) =>
            f
              .setLabel(BOARD_KEYS.backlog.close.message)
              .setItems(options)
              .setLabelKey('label')
              .setValueKey('uuid')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().moveUnfinishedToSprintUuid ?? BACKLOG_OPTION_VALUE,
            onChange: (value) =>
              this.command().update((cmd) => ({
                ...cmd,
                moveUnfinishedToSprintUuid: value === BACKLOG_OPTION_VALUE ? undefined : (value ?? undefined),
              })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
