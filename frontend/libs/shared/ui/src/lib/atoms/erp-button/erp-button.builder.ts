import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpButtonConfig, ErpButtonIconPosition, ErpButtonSeverity, ErpButtonVariant } from './erp-button.component';

/** Preset: przycisk 'Save' (zielony, ikona dyskietki). */
export function ErpButtonSave(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Save').setSeverity('success').setIcon('pi pi-save');
}

/** Preset: przycisk 'Remove' (czerwony, ikona kosza). */
export function ErpButtonRemove(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Remove').setSeverity('danger').setIcon('pi pi-trash');
}

/** Preset: przycisk 'Cancel' (szary, ikona X). */
export function ErpButtonCancel(builder: ErpButtonBuilder): ErpButtonBuilder {
  return builder.setLabel('Cancel').setSeverity('secondary').setIcon('pi pi-times');
}

/**
 * https://primeng.org/button#api.button.props.label
 */
export class ErpButtonBuilder extends ErpBaseBuilder<ErpButtonConfig> {
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
  public setRounded(rounded = true): this {
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

  /** Rozmiar przycisku: 'small', 'large' lub undefined (normalny). */
  public setSize(size: 'small' | 'large' | undefined): this {
    this._data.size = size;
    return this;
  }

  /** Callback wywoływany po kliknięciu przycisku. */
  public setOnClick(callback: () => void): this {
    this._data.onClick = callback;
    return this;
  }
}
