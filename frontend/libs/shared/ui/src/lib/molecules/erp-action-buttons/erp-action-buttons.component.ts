import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpButtonComponent } from '../../atoms/erp-button';
import { ErpActionButtonsConfig } from './erp-action-buttons.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-action-buttons',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  template: `
    @let _buttons = buttons();
    @let _alignment = alignment();
    @let _gap = gap();

    <div
      class="flex items-center"
      [ngClass]="{
        'justify-start': _alignment === 'start',
        'justify-end': _alignment === 'end' || !_alignment,
        'justify-center': _alignment === 'center',
        'justify-between': _alignment === 'between'
      }"
      [style.gap.rem]="_gap ?? 0.5"
    >
      @for (btn of _buttons; track btn.id) {
        <erp-button
          [config]="btn"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpActionButtonsComponent {
  public config = input.required<ErpActionButtonsConfig>();
  public buttonClick = output<string>();

  protected buttons = computed(() => {
    const rawButtons = unwrapSignal(this.config().buttons) ?? [];
    return rawButtons.map((btn) => ({
      ...btn,
      onClick: () => this.buttonClick.emit(btn.id),
    }));
  });
  protected alignment = computed(() => unwrapSignal(this.config().alignment));
  protected gap = computed(() => unwrapSignal(this.config().gap));
}
