import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { ErpButtonComponent, ErpInputComponent, ErpInputNumberComponent, ErpInputPickerComponent, ErpTranslatePipe } from '@erp/shared/ui';

import { ErpWorkLogPanelConfig } from './erp-work-log-panel.types';

/**
 * Sekcja czasu na karcie zgłoszenia (TIME-001/002) — estymata z edycją inline, zalogowane
 * i pozostałe minuty, lista wpisów, formularz dodania. Feature dostarcza dane, komendy,
 * kontrolki formularza i klucze tłumaczeń (z własnego rejestru); panel tylko renderuje.
 */
@Component({
  selector: 'erp-work-log-panel',
  standalone: true,
  imports: [DatePipe, ErpButtonComponent, ErpInputComponent, ErpInputNumberComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    @let c = config();
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          {{ c.estimateLabel | erpTranslate }}:
          @if (c.editingEstimate) {
            <erp-input-number
              class="w-20"
              [config]="c.estimateInputConfig"
              [control]="c.estimateControl"
              (keydown.enter)="c.onSaveEstimate()"
            />
            <erp-button [config]="c.saveEstimateButton" />
            <erp-button [config]="c.cancelEstimateButton" />
          } @else {
            <strong>
              @if (c.estimateMinutesOrNull !== null) {
                {{ c.formatMinutes(c.estimateMinutesOrNull) | erpTranslate }}
              } @else {
                {{ c.noEstimateLabel | erpTranslate }}
              }
            </strong>
            @if (c.canEdit) {
              <erp-button [config]="c.editEstimateButton" />
            }
          }
        </span>

        <span>
          {{ c.loggedLabel | erpTranslate }}:
          <strong>{{ c.formatMinutes(c.loggedMinutes) | erpTranslate }}</strong>
        </span>

        @if (c.remainingMinutes !== null) {
          <span>
            {{ c.remainingLabel | erpTranslate }}:
            <strong>{{ c.formatMinutes(c.remainingMinutes) | erpTranslate }}</strong>
          </span>
        }
      </div>

      @if (c.entries.length > 0) {
        <ul class="m-0 flex flex-col gap-1 p-0 text-sm">
          @for (entry of c.entries; track entry.uuid) {
            <li class="flex items-center gap-2">
              <span class="text-[var(--tui-text-secondary)]">{{ entry.loggedOn | date: 'yyyy-MM-dd' }}</span>
              <span>{{ entry.workTypeName }}</span>
              <strong>{{ c.formatMinutes(entry.minutes) | erpTranslate }}</strong>
              @if (entry.description) {
                <span class="text-[var(--tui-text-secondary)]">— {{ entry.description }}</span>
              }
              @if (entry.isMine) {
                <erp-button [config]="c.getRemoveButton(entry)" />
              }
            </li>
          }
        </ul>
      } @else {
        <p class="m-0 text-[var(--tui-text-secondary)]">{{ c.noEntriesLabel | erpTranslate }}</p>
      }

      @if (c.canEdit) {
        <div class="flex flex-wrap items-center gap-2">
          <erp-input-picker class="min-w-32" [config]="c.workTypePickerConfig" [control]="c.workTypeControl" />
          <erp-input-number
            class="w-24"
            [config]="c.minutesInputConfig"
            [control]="c.minutesControl"
            (keydown.enter)="c.onAddWorkLog()"
          />
          <erp-input class="min-w-32 flex-1" [config]="c.descriptionInputConfig" [control]="c.descriptionControl" (keydown.enter)="c.onAddWorkLog()" />
          <erp-button [config]="c.addButton" />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpWorkLogPanelComponent {
  public readonly config = input.required<ErpWorkLogPanelConfig>();
}
