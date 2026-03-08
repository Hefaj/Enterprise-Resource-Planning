import { EBaseBuilder } from '../../_base/e-base-builder';
import { EButton, EButtonIconPosition, EButtonSeverity, EButtonVariant } from './e-button.component';

export function EButtonSave(builder: EButtonBuilder): EButtonBuilder {
  return builder.setLabel('Save').setSeverity('success').setIcon('pi pi-save');
}

export function EButtonRemove(builder: EButtonBuilder): EButtonBuilder {
  return builder.setLabel('Remove').setSeverity('danger').setIcon('pi pi-trash');
}

export function EButtonCancel(builder: EButtonBuilder): EButtonBuilder {
  return builder.setLabel('Cancel').setSeverity('secondary').setIcon('pi pi-times');
}

/**
 * https://primeng.org/button#api.button.props.label
 */
export class EButtonBuilder extends EBaseBuilder<EButton> {
  public setLabel(label: string): this {
    this._data.label = label;
    return this;
  }

  /**
   * https://primeng.org/button#api.button.props.icon
   * https://primeng.org/button#api.button.props.iconPos
   */
  public setIcon(icon: string, iconPos?: EButtonIconPosition): this {
    this._data.icon = icon;
    this._data.iconPos = iconPos;
    return this;
  }

  /**
   * https://primeng.org/button#api.button.props.severity
   */
  public setSeverity(severity: EButtonSeverity): this {
    this._data.severity = severity;
    return this;
  }

  /**
   * https://primeng.org/button#api.buttondirective.props.rounded
   */
  public withRounded(rounded = true): this {
    this._data.rounded = rounded;
    return this;
  }

  /**
   * https://primeng.org/button#api.button.props.variant
   */
  public setVariant(variant: EButtonVariant): this {
    this._data.variant = variant;
    return this;
  }
}
