import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ButtonIconPosition, ButtonModule } from 'primeng/button';
import { ErpButtonBuilder, ErpButtonSave, ErpButtonCancel, ErpButtonRemove } from './erp-button.builder';

export { ErpButtonBuilder };
export { ErpButtonSave, ErpButtonCancel, ErpButtonRemove };

export type ErpButtonSeverity = 'secondary' | 'success' | 'info' | 'warn' | 'help' | 'danger' | 'contrast';
export type ErpButtonVariant = 'outlined' | 'text';
export type ErpButtonIconPosition = ButtonIconPosition;

export interface ErpButtonConfig {
  label?: string;
  icon?: string;
  iconPos?: ErpButtonIconPosition;
  severity?: ErpButtonSeverity;
  rounded?: boolean;
  variant?: ErpButtonVariant;
  size?: "small" | "large" | undefined;
  onClick?: () => void;
}

@Component({
  selector: 'erp-button',
  imports: [ButtonModule],
  template: `
    @let _config = config();
    @let _loading = loading();
    @let _disabled = disabled();
    @let _badge = badge();

    <p-button
      [label]="_config.label"
      [severity]="_config.severity"
      [rounded]="_config.rounded"
      [variant]="_config.variant"
      [icon]="_config.icon"
      [iconPos]="_config.iconPos ?? 'left'"
      [badge]="_badge"
      [loading]="_loading"
      [disabled]="_disabled"
      [size]="_config.size"
      (onClick)="handleClick()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpButtonComponent {
  public config = input.required<ErpButtonConfig>();
  public loading = input<boolean>(false);

  /**
   * https://primeng.org/button#api.button.props.disabled
   */
  public disabled = input<boolean>(false);

  /**
   * https://primeng.org/button#api.button.props.badge
   */
  public badge = input<string>();

  protected handleClick(): void {
    const callback = this.config().onClick;
    if (callback) {
      callback();
    }
  }
}
