import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpSplitterConfig, ErpSplitterPanel } from './erp-splitter.types';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { MaybeSignal } from '../../base/erp-signal-utils';

export class ErpSplitterBuilder extends ErpBaseBuilder<ErpSplitterConfig> {
  constructor() {
    super();
  }

  public setLayout(layout: MaybeSignal<'horizontal' | 'vertical' | undefined>): this {
    this._data.layout = layout;
    return this;
  }

  public setGutterSize(gutterSize: MaybeSignal<number | undefined>): this {
    this._data.gutterSize = gutterSize;
    return this;
  }

  public setStyle(style: MaybeSignal<Record<string, string> | undefined>): this {
    this._data.style = style;
    return this;
  }

  public setStyleClass(styleClass: MaybeSignal<string | undefined>): this {
    this._data.styleClass = styleClass;
    return this;
  }

  public setPanelSizes(panelSizes: MaybeSignal<number[] | undefined>): this {
    this._data.panelSizes = panelSizes;
    return this;
  }

  public setMinSizes(minSizes: MaybeSignal<number[] | undefined>): this {
    this._data.minSizes = minSizes;
    return this;
  }

  public setPanels(panels: MaybeSignal<ErpSplitterPanel[]>): this {
    this._data.panels = panels;
    return this;
  }

  public addPanel<T = any>(options: {
    size?: MaybeSignal<number | undefined>;
    minSize?: MaybeSignal<number | undefined>;
    component: MaybeSignal<Type<T>>;
    config?: MaybeSignal<ErpComponentSignalInputs<T> | any>;
    styleClass?: MaybeSignal<string | undefined>;
    style?: MaybeSignal<Record<string, string> | undefined>;
  }): this {
    const panel: ErpSplitterPanel = {
      size: options.size,
      minSize: options.minSize,
      component: options.component,
      config: options.config,
      styleClass: options.styleClass,
      style: options.style,
    };
    if (!Array.isArray(this._data.panels)) {
      this._data.panels = [];
    }
    this._data.panels.push(panel);
    return this;
  }
}
