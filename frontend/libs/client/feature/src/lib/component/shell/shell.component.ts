import { Component, signal, inject, computed } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ErpBreadcrumbComponent, ErpBreadcrumbBuilder } from '@erp/shared/ui/erp-breadcrumb';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui/erp-button';
import { ErpDrawerComponent, ErpDrawerBuilder } from '@erp/shared/ui/erp-drawer';
import { SHARED_KEYS } from '@erp/shared/ui';
import { ErpBreadcrumbService, ErpNavRegistryService } from '@erp/shared/data-access';
import { ThemeService, LanguageService, AppLanguage } from '@erp/client/util';
import { ErpSettingsMenuComponent, ErpSettingsMenuConfig, ErpSettingsMenuItem, ErpCompanySelectorComponent, ErpUpdateIndicatorComponent, ErpNotificationsComponent, ErpTasksComponent } from '@erp/client/ui';
import { NavigationMenuComponent } from './navigation-menu.component';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    ErpBreadcrumbComponent,
    ErpButtonComponent,
    ErpDrawerComponent,
    ErpSettingsMenuComponent,
    ErpCompanySelectorComponent,
    ErpUpdateIndicatorComponent,
    ErpNotificationsComponent,
    ErpTasksComponent,
  ],
  templateUrl: './shell.component.html',
  styles: [`
    a.active-link {
      background: var(--tui-background-neutral-1-hover) !important;
      font-weight: 600;
    }
  `],
  host: {
    style: 'display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;'
  }
})
export class ShellLayoutComponent {
  private readonly _themeService = inject(ThemeService);
  private readonly _languageService = inject(LanguageService);
  private readonly _breadcrumbService = inject(ErpBreadcrumbService);
  private readonly _navRegistry = inject(ErpNavRegistryService);

  public readonly isDarkMode = this._themeService.isDarkMode;
  public readonly navMenu = this._navRegistry.$navMenu;
  public readonly menuOpen = signal(false);

  // Spółki
  public readonly currentCompany = signal<string>('Sklep Opon');
  public readonly companies = signal<string[]>(['Sklep Opon', 'Sklep rowerowy', 'Hurtownia Części']);

  // Aktualizacje
  public readonly updateAvailable = signal<boolean>(true);

  public readonly breadcrumbConfig = ErpBreadcrumbBuilder.create((b) =>
    b.setItems(
      computed(() => {
        const data = this._breadcrumbService.breadcrumb();
        return [data.home, ...data.items];
      })
    )
  );

  private readonly _dataLanguages = signal<{ code: string; name: string }[]>([]);
  private readonly _selectedDataLang = signal<string>('pl');

  public readonly dataLanguagesItems = computed<ErpSettingsMenuItem[]>(() => {
    const langs = this._dataLanguages();
    if (langs.length === 0) {
      return [
        {
          id: 'loading-data-langs',
          label: SHARED_KEYS.settings.loading,
          disabled: true
        }
      ];
    }
    return langs.map(lang => ({
      id: `data-lang-${lang.code}`,
      label: lang.name,
      active: computed(() => this._selectedDataLang() === lang.code),
      fn: () => this._selectedDataLang.set(lang.code)
    }));
  });

  public constructor() {
    // Symulacja pobierania danych języków z backendu po 3 sekundach
    setTimeout(() => {
      this._dataLanguages.set([
        { code: 'pl', name: 'Polski (Dane)' },
        { code: 'en', name: 'English (Data)' },
        { code: 'de', name: 'Deutsch (Data)' }
      ]);
    }, 3000);
  }

  public readonly menuButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setAppearance('icon')
      .setIconStart('@tui.menu')
      .setFn(() => this.menuOpen.set(true))
  );

  public readonly settingsMenuConfig: ErpSettingsMenuConfig = {
    items: [
      {
        id: 'theme',
        label: computed(() => this.isDarkMode() ? SHARED_KEYS.settings.theme.light : SHARED_KEYS.settings.theme.dark),
        icon: computed(() => this.isDarkMode() ? '@tui.sun' : '@tui.moon'),
        fn: () => this.toggleTheme()
      },
      {
        id: 'language',
        label: SHARED_KEYS.settings.language.title,
        icon: '@tui.globe',
        children: [
          {
            id: 'lang-pl',
            label: SHARED_KEYS.settings.language.pl,
            active: computed(() => this._languageService.language() === 'pl-PL'),
            fn: () => this.setLanguage('pl-PL')
          },
          {
            id: 'lang-en',
            label: SHARED_KEYS.settings.language.en,
            active: computed(() => this._languageService.language() === 'en-US'),
            fn: () => this.setLanguage('en-US')
          }
        ]
      },
      {
        id: 'data-language',
        label: SHARED_KEYS.settings.language.dataTitle,
        icon: '@tui.database',
        children: this.dataLanguagesItems
      },
      {
        id: 'report-issue',
        label: SHARED_KEYS.settings.reportIssue,
        icon: '@tui.message-circle',
        separator: true,
        fn: () => this.reportIssue()
      }
    ]
  };

  public readonly menuDrawerConfig = ErpDrawerBuilder.create((b) =>
    b
      .setOpen(this.menuOpen)
      .setTitle(SHARED_KEYS.navigation)
      .setOverlay(true)
      .setDirection('start')
      .setComponent(NavigationMenuComponent)
      .setOnClose(() => this.menuOpen.set(false))
  );

  public toggleTheme(): void {
    this._themeService.toggleTheme();
  }

  public setLanguage(lang: AppLanguage): void {
    this._languageService.setLanguage(lang);
  }

  public reportIssue(): void {
    console.log('Report issue clicked');
  }

  public selectCompany(company: string): void {
    this.currentCompany.set(company);
    console.log('Selected company:', company);
  }

  public updateApp(): void {
    alert('Symulacja pobierania nowej wersji aplikacji... Trwa aktualizacja.');
    this.updateAvailable.set(false);
  }

  public openNotifications(): void {
    console.log('Notifications clicked');
  }

  public openTasks(): void {
    console.log('Tasks clicked');
  }
}
