import { ErpBaseBuilder, MaybeSignal } from '@erp/shared/ui';

import {
  ErpFieldPanelConfig,
  ErpFieldPanelOption,
  ErpFieldPanelRow,
  ErpFieldPanelTransition,
} from './erp-field-panel.types';

export class ErpFieldPanelBuilder extends ErpBaseBuilder<ErpFieldPanelConfig> {
  public setStateLabel(value: MaybeSignal<string>): this {
    this._data.stateLabel = value;
    return this;
  }

  public setTransitions(value: MaybeSignal<readonly ErpFieldPanelTransition[]>): this {
    this._data.transitions = value;
    return this;
  }

  public setTransitionsEnabled(value: MaybeSignal<boolean>): this {
    this._data.transitionsEnabled = value;
    return this;
  }

  public setTypeValue(value: MaybeSignal<string | undefined>): this {
    this._data.typeValue = value;
    return this;
  }

  public setTypeOptions(value: MaybeSignal<readonly ErpFieldPanelOption[] | undefined>): this {
    this._data.typeOptions = value;
    return this;
  }

  public setTypeEditable(value: MaybeSignal<boolean>): this {
    this._data.typeEditable = value;
    return this;
  }

  public setRows(value: MaybeSignal<readonly ErpFieldPanelRow[]>): this {
    this._data.rows = value;
    return this;
  }
}
