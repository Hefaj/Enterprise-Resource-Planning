import { Injectable, signal, effect, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export enum ErpPreferencesType {
  Table = 'tables',
  Filter = 'filters',
  PageLayout = 'pageLayouts',
}

export interface ErpPreferencesMap {
  [ErpPreferencesType.Table]: any;
  [ErpPreferencesType.Filter]: any;
  [ErpPreferencesType.PageLayout]: any;
}

export interface ErpUserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  headerMode?: 'fixed' | 'auto-hide';
  tables?: Record<string, any>;
  filters?: Record<string, any>;
  pageLayouts?: Record<string, any>;
  fontSize?: 's' | 'm' | 'l' | 'xl';
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

      // Apply font size globally
      effect(() => {
        const size = this._state().fontSize || 'm';
        let rootSize = '16px';
        if (size === 's') rootSize = '14px';
        if (size === 'l') rootSize = '18px';
        if (size === 'xl') rootSize = '20px';
        document.documentElement.style.fontSize = rootSize;
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

  public get fontSize(): 's' | 'm' | 'l' | 'xl' | undefined {
    return this._state().fontSize;
  }

  public setFontSize(fontSize: 's' | 'm' | 'l' | 'xl'): void {
    this._state.update((s) => ({ ...s, fontSize }));
  }

  public getState<T extends ErpPreferencesType>(type: T, key: string): ErpPreferencesMap[T] | undefined {
    return this._state()[type]?.[key];
  }

  public saveState<T extends ErpPreferencesType>(type: T, key: string, payload: ErpPreferencesMap[T]): void {
    this._state.update((s) => ({
      ...s,
      [type]: {
        ...(s[type] || {}),
        [key]: payload,
      },
    }));
  }

  public getFilterPresets(key: string): Record<string, any> {
    return this.getState(ErpPreferencesType.Filter, key) || {};
  }

  public saveFilterPreset(key: string, presetName: string, values: any): void {
    const currentPresets = this.getFilterPresets(key);
    this.saveState(ErpPreferencesType.Filter, key, { ...currentPresets, [presetName]: values });
  }

  public deleteFilterPreset(key: string, presetName: string): void {
    const currentPresets = this.getFilterPresets(key);
    const newPresets = { ...currentPresets };
    delete newPresets[presetName];
    this.saveState(ErpPreferencesType.Filter, key, newPresets);
  }
}
