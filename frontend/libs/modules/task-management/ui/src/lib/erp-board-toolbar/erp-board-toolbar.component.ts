import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe } from '@erp/shared/ui';

import { ErpBoardToolbarConfig } from './erp-board-toolbar.types';

/**
 * Pasek nad tablicą: nazwa, wybór grupowania w swimlane'y i link do backlogu.
 *
 * <p>Kontrolki formularza (`swimlaneModeControl`/`swimlaneFieldCodeControl`) zostają
 * własnością feature — ten komponent tylko je renderuje przez wspólny picker/input, żeby
 * zachować obsługę klawiatury i tłumaczeń identyczną z filtrami list.</p>
 */
@Component({
  selector: 'erp-board-toolbar',
  standalone: true,
  imports: [ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex items-center justify-between gap-2">
      <span class="text-lg font-medium">{{ _boardName() | erpTranslate }}</span>

      <div class="flex items-center gap-3">
        <erp-input-picker class="min-w-48" [config]="config().swimlanePickerConfig" [control]="swimlaneModeControl()" />

        @if (_swimlaneFieldCodeInputConfig(); as fieldConfig) {
          <erp-input class="w-40" [config]="fieldConfig" [control]="swimlaneFieldCodeControl()" />
        }

        @if (_backlogLink(); as link) {
          <a class="text-sm underline" [routerLink]="link.routerLink">{{ link.labelKey | erpTranslate }}</a>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBoardToolbarComponent {
  public readonly config = input.required<ErpBoardToolbarConfig>();
  public readonly swimlaneModeControl = input.required<FormControl<number>>();
  public readonly swimlaneFieldCodeControl = input.required<FormControl<string>>();

  protected readonly _boardName = computed(() => this.config().boardName);
  protected readonly _swimlaneFieldCodeInputConfig = computed(() => this.config().swimlaneFieldCodeInputConfig);
  protected readonly _backlogLink = computed(() => this.config().backlogLink);
}
