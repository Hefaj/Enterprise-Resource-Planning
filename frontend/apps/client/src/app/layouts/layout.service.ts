import { Injectable, signal, computed, effect } from '@angular/core';

export interface LayoutConfig {
  preset: string;
  primary: string;
  surface: string | undefined | null;
  darkTheme: boolean;
  menuMode: string;
}

interface LayoutState {
  staticMenuDesktopInactive: boolean;
  overlayMenuActive: boolean;
  configSidebarVisible: boolean;
  mobileMenuActive: boolean;
  menuHoverActive: boolean;
  activePath: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  public layoutConfig = signal<LayoutConfig>({
    preset: 'Aura',
    primary: 'emerald',
    surface: null,
    darkTheme: false,
    menuMode: 'static',
  });

  public layoutState = signal<LayoutState>({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    configSidebarVisible: false,
    mobileMenuActive: false,
    menuHoverActive: false,
    activePath: null,
  });

  public theme = computed(() => (this.layoutConfig().darkTheme ? 'light' : 'dark'));

  public isSidebarActive = computed(() => this.layoutState().overlayMenuActive || this.layoutState().mobileMenuActive);

  public isDarkTheme = computed(() => this.layoutConfig().darkTheme);

  public getPrimary = computed(() => this.layoutConfig().primary);

  public getSurface = computed(() => this.layoutConfig().surface);

  public isOverlay = computed(() => this.layoutConfig().menuMode === 'overlay');

  public transitionComplete = signal<boolean>(false);

  private _initialized = false;

  public constructor() {
    effect(() => {
      const config = this.layoutConfig();

      if (!this._initialized || !config) {
        this._initialized = true;
        return;
      }

      this._handleDarkModeTransition(config);
    });
  }

  private _handleDarkModeTransition(config: LayoutConfig): void {
    const supportsViewTransition = 'startViewTransition' in document;

    if (supportsViewTransition) {
      this._startViewTransition(config);
    } else {
      this.toggleDarkMode(config);
    }
  }

  private _startViewTransition(config: LayoutConfig): void {
    document.startViewTransition(() => {
      this.toggleDarkMode(config);
    });
  }

  public toggleDarkMode(config?: LayoutConfig): void {
    const _config = config || this.layoutConfig();
    if (_config.darkTheme) {
      document.documentElement.classList.add('app-dark');
    } else {
      document.documentElement.classList.remove('app-dark');
    }
  }

  public onMenuToggle(): void {
    if (this.isOverlay()) {
      this.layoutState.update((prev) => ({ ...prev, overlayMenuActive: !this.layoutState().overlayMenuActive }));
    }

    if (this.isDesktop()) {
      this.layoutState.update((prev) => ({
        ...prev,
        staticMenuDesktopInactive: !this.layoutState().staticMenuDesktopInactive,
      }));
    } else {
      this.layoutState.update((prev) => ({ ...prev, mobileMenuActive: !this.layoutState().mobileMenuActive }));
    }
  }

  public showConfigSidebar(): void {
    this.layoutState.update((prev) => ({ ...prev, configSidebarVisible: true }));
  }

  public hideConfigSidebar(): void {
    this.layoutState.update((prev) => ({ ...prev, configSidebarVisible: false }));
  }

  public isDesktop(): boolean {
    return window.innerWidth > 991;
  }

  public isMobile(): boolean {
    return !this.isDesktop();
  }
}
