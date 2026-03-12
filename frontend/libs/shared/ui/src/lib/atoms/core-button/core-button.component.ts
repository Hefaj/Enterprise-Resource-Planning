import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ButtonIconPosition, ButtonModule } from 'primeng/button';
import { CoreButtonBuilder, CoreButtonSave, CoreButtonCancel, CoreButtonRemove } from './core-button.builder';

export { CoreButtonBuilder as EButtonBuilder };
export { CoreButtonSave as EButtonSave, CoreButtonCancel as EButtonCancel, CoreButtonRemove as EButtonRemove };

export type EButtonSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'help' | 'danger' | 'contrast';
export type EButtonVariant = 'outlined' | 'text';
export type EButtonIconPosition = ButtonIconPosition;

export interface CoreButton {
  label?: string;
  icon?: string;
  iconPos?: EButtonIconPosition;
  severity?: EButtonSeverity;
  rounded?: boolean;
  variant?: EButtonVariant;
}

@Component({
  selector: 'core-button',
  imports: [ButtonModule],
  templateUrl: './core-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreButtonComponent {
  public config = input.required<CoreButton>();
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
