import { Injectable, signal, effect, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ErpUserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  headerMode?: 'fixed' | 'auto-hide';
  tables?: Record<string, any>;
  filters?: Record<string, any>;
  pageLayouts?: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class ErpUserPreferencesService {
  private readonly STORAGE_KEY = 'erp-user-preferences';
  private readonly _state = signal<ErpUserPreferences>({});

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromStorage();
      
      // Auto-save on change
      effect(() => {
        const currentState = this._state();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentState));
      });
    }
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this._state.set(JSON.parse(saved));
      } catch (e) {
        console.error('[ErpUserPreferencesService] Error parsing preferences', e);
      }
    }
  }

  public get theme(): 'light' | 'dark' | undefined {
    return this._state().theme;
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this._state.update((s) => ({ ...s, theme }));
  }

  public get language(): string | undefined {
    return this._state().language;
  }

  public setLanguage(language: string): void {
    this._state.update((s) => ({ ...s, language }));
  }

  public get headerMode(): 'fixed' | 'auto-hide' | undefined {
    return this._state().headerMode;
  }

  public setHeaderMode(headerMode: 'fixed' | 'auto-hide'): void {
    this._state.update((s) => ({ ...s, headerMode }));
  }

  public getTableState(key: string): any {
    return this._state().tables?.[key];
  }

  public saveTableState(key: string, tableState: any): void {
    this._state.update((s) => {
      const currentTables = s.tables || {};
      return {
        ...s,
        tables: {
          ...currentTables,
          [key]: tableState,
        },
      };
    });
  }

  public getFilterState(key: string): any {
    return this._state().filters?.[key];
  }

  public saveFilterState(key: string, filterState: any): void {
    this._state.update((s) => {
      const currentFilters = s.filters || {};
      return {
        ...s,
        filters: {
          ...currentFilters,
          [key]: filterState,
        },
      };
    });
  }

  public getFilterPresets(key: string): Record<string, any> {
    return this.getFilterState(key) || {};
  }

  public saveFilterPreset(key: string, presetName: string, values: any): void {
    const currentPresets = this.getFilterPresets(key);
    this.saveFilterState(key, { ...currentPresets, [presetName]: values });
  }

  public deleteFilterPreset(key: string, presetName: string): void {
    const currentPresets = this.getFilterPresets(key);
    const newPresets = { ...currentPresets };
    delete newPresets[presetName];
    this.saveFilterState(key, newPresets);
  }

  public getPageLayoutState(key: string): any {
    return this._state().pageLayouts?.[key];
  }

  public savePageLayoutState(key: string, layoutState: any): void {
    this._state.update((s) => {
      const currentLayouts = s.pageLayouts || {};
      return {
        ...s,
        pageLayouts: {
          ...currentLayouts,
          [key]: layoutState,
        },
      };
    });
  }
}
