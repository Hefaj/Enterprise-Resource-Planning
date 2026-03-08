import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ButtonIconPosition, ButtonModule } from 'primeng/button';
import { EButtonBuilder, EButtonSave, EButtonCancel, EButtonRemove } from './e-button.builder';

export { EButtonBuilder };
export { EButtonSave, EButtonCancel, EButtonRemove };

export type EButtonSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'help' | 'danger' | 'contrast';
export type EButtonVariant = 'outlined' | 'text';
export type EButtonIconPosition = ButtonIconPosition;

export interface EButton {
  label?: string;
  icon?: string;
  iconPos?: EButtonIconPosition;
  severity?: EButtonSeverity;
  rounded?: boolean;
  variant?: EButtonVariant;
}

@Component({
  selector: 'e-button',
  imports: [ButtonModule],
  templateUrl: './e-button.component.html',
  styleUrl: './e-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EButtonComponent {
  public config = input.required<EButton>();
  public loading = input<boolean>(false);

  /**
   * https://primeng.org/button#api.button.props.disabled
   */
  public disabled = input<boolean>(false);

  /**
   * https://primeng.org/button#api.button.props.badge
   */
  public badge = input<string>();
}
