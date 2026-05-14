import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpButtonConfig, ErpButtonIconPosition, ErpButtonSeverity, ErpButtonVariant, ErpButtonSize } from './erp-button.types';

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

export class ErpButtonBuilder extends ErpBaseBuilder<ErpButtonConfig> {


  public setLabel(label: MaybeSignal<string | undefined>): this {
    this._data.label = label;
    return this;
  }

  public setIcon(icon: MaybeSignal<string | undefined>, iconPos?: MaybeSignal<ErpButtonIconPosition | undefined>): this {
    this._data.icon = icon;
    if (iconPos !== undefined) {
      this._data.iconPos = iconPos;
    }
    return this;
  }

  public setSeverity(severity: MaybeSignal<ErpButtonSeverity | undefined>): this {
    this._data.severity = severity;
    return this;
  }

  public setRounded(rounded: MaybeSignal<boolean | undefined> = true): this {
    this._data.rounded = rounded;
    return this;
  }

  public setVariant(variant: MaybeSignal<ErpButtonVariant | undefined>): this {
    this._data.variant = variant;
    return this;
  }

  public setSize(size: MaybeSignal<ErpButtonSize | undefined>): this {
    this._data.size = size;
    return this;
  }

  public setLoading(loading: MaybeSignal<boolean | undefined>): this {
    this._data.loading = loading;
    return this;
  }

  public setDisabled(disabled: MaybeSignal<boolean | undefined>): this {
    this._data.disabled = disabled;
    return this;
  }

  public setBadge(badge: MaybeSignal<string | undefined>): this {
    this._data.badge = badge;
    return this;
  }

  public setOnClick(callback: (event: MouseEvent) => void | Promise<void>): this {
    this._data.onClick = callback;
    return this;
  }
}
