import { ErpBaseBuilder } from '../../_base/erp-base-builder';
import { CoreButton, ErpButtonIconPosition, ErpButtonSeverity, ErpButtonVariant } from './erp-button.component';

export function ErpButtonSave(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Save').setSeverity('success').setIcon('pi pi-save');
}

export function ErpButtonRemove(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Remove').setSeverity('danger').setIcon('pi pi-trash');
}

export function ErpButtonCancel(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Cancel').setSeverity('secondary').setIcon('pi pi-times');
}

/**
 * https://primeng.org/button#api.button.props.label
 */
export class ErpButtonBuilder extends ErpBaseBuilder<CoreButton> {
  public setLabel(label: string): this {
    this._data.label = label;
    return this;
  }

  /**
   * https://primeng.org/button#api.button.props.icon
   * https://primeng.org/button#api.button.props.iconPos
   */
  public setIcon(icon: string, iconPos?: ErpButtonIconPosition): this {
    this._data.icon = icon;
    this._data.iconPos = iconPos;
    return this;
  }

  /**
   * https://primeng.org/button#api.button.props.severity
   */
  public setSeverity(severity: ErpButtonSeverity): this {
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
  public setVariant(variant: ErpButtonVariant): this {
    this._data.variant = variant;
    return this;
  }
}
