declare const ngDevMode: boolean | undefined;

import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import {
  ErpGridAreaOptions,
  ErpGridDefinition,
  ErpGridLayoutConfig,
} from './erp-grid-layout.types';

export class ErpGridLayoutBuilder extends ErpBaseBuilder<ErpGridLayoutConfig> {
  private _areaNames = new Set<string>();

  constructor() {
    super();
    this._data.areas = new Map();
  }

  /**
   * Definiuje kompletną siatkę CSS Grid.
   * Jedyne API do definicji grida — zawiera areas, columns, rows i gap.
   */
  public setGrid(definition: ErpGridDefinition): this {
    this._data.grid = definition;
    
    // Parsuj unikalne nazwy area z template
    this._areaNames = new Set(
      definition.areas
        .flatMap((row) => row.trim().split(/\s+/))
        .filter((name) => name !== '.')
    );
    
    return this;
  }

  /** ID layoutu dla preferencji użytkownika (ErpUserPreferencesService). */
  public setLayoutId(id: string): this {
    this._data.layoutId = id;
    return this;
  }

  /** Wymusza wyświetlanie obramowań dla wszystkich sekcji */
  public setShowBorders(show: boolean = true): this {
    this._data.showBorders = show;
    return this;
  }

  /**
   * Wypełnia nazwany obszar grida komponentem.
   * Waliduje, że areaName istnieje w zdefiniowanej siatce (dev mode).
   */
  public fill<TComponent>(
    areaName: string,
    component: Type<TComponent>,
    inputs?: ErpComponentSignalInputs<TComponent>,
    options?: ErpGridAreaOptions
  ): this {
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      if (this._areaNames.size > 0 && !this._areaNames.has(areaName)) {
        console.warn(
          `[ErpGridLayoutBuilder] Area "${areaName}" not found in grid template. ` +
          `Available areas: ${[...this._areaNames].join(', ')}`
        );
      }
    }
    
    this._data.areas!.set(areaName, { areaName, component, inputs, options });
    return this;
  }
}
