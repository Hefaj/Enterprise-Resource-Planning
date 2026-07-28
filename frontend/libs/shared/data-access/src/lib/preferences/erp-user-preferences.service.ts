import { Injectable, signal, effect, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ErpUserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  tables?: Record<string, any>;
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
}
