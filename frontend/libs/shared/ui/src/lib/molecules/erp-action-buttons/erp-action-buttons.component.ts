import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpButtonComponent, ErpButtonConfig } from '../../atoms/erp-button/erp-button.component';

export interface ErpActionButtonsConfig {
  buttons: (ErpButtonConfig & { id: string })[];
  alignment?: 'start' | 'end' | 'center' | 'between';
  gap?: number;
}

@Component({
  selector: 'erp-action-buttons',
  standalone: true,
  imports: [CommonModule, ErpButtonComponent],
  template: `
    @let _config = config();
    <div 
      class="flex items-center" 
      [ngClass]="{
        'justify-start': _config.alignment === 'start',
        'justify-end': _config.alignment === 'end' || !_config.alignment,
        'justify-center': _config.alignment === 'center',
        'justify-between': _config.alignment === 'between'
      }"
      [style.gap.rem]="_config.gap || 0.5"
    >
      @for (btn of _config.buttons; track btn.id) {
        <erp-button [config]="btn" (click)="buttonClick.emit(btn.id)" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpActionButtonsComponent {
  public config = input.required<ErpActionButtonsConfig>();
  public tabValue = input<string | number>();
  public buttonClick = output<string>();
}
