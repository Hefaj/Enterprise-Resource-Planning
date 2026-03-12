import { CoreBaseBuilder } from '../../_base/core-base-builder';
import { CoreButton, EButtonIconPosition, EButtonSeverity, EButtonVariant } from './core-button.component';

export function CoreButtonSave(builder: CoreButtonBuilder): CoreButtonBuilder {
  return builder.setLabel('Save').setSeverity('success').setIcon('pi pi-save');
}

export function CoreButtonRemove(builder: CoreButtonBuilder): CoreButtonBuilder {
  return builder.setLabel('Remove').setSeverity('danger').setIcon('pi pi-trash');
}

export function CoreButtonCancel(builder: CoreButtonBuilder): CoreButtonBuilder {
  return builder.setLabel('Cancel').setSeverity('secondary').setIcon('pi pi-times');
}

/**
 * https://primeng.org/button#api.button.props.label
 */
export class CoreButtonBuilder extends CoreBaseBuilder<CoreButton> {
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
