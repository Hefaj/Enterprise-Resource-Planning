import { Component, signal, inject, computed, effect, untracked, Injector, Type } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl } from '@angular/forms';
import { ErpBreadcrumbComponent, ErpBreadcrumbBuilder } from '@erp/shared/ui/erp-breadcrumb';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui';
import { ErpDrawerComponent, ErpDrawerBuilder } from '@erp/shared/ui/erp-drawer';
import { SHARED_KEYS } from '@erp/shared/ui';
import {
  ErpBreadcrumbService,
  ErpNavRegistryService,
  AppLanguage,
  ErpUserPreferencesService,
  ErpWidgetRegistryService,
  JobService,
  JOB_LIST_WIDGET_ID,
} from '@erp/shared/data-access';
import { AppSettingsService } from '@erp/client/util';
import { ErpSettingsMenuComponent, ErpSettingsMenuConfig, ErpSettingsMenuItem, ErpCompanySelectorComponent, ErpUpdateIndicatorComponent, ErpNotificationsComponent, ErpTasksComponent, ErpNavigationMenuComponent } from '@erp/client/ui';
import { ErpToggleGroupComponent, ErpToggleGroupBuilder } from '@erp/shared/ui';

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
    .header-auto-hide {
      position: absolute !important;
      width: 100%;
      transform: translateY(-100%);
      transition: transform 0.3s ease-in-out;
    }
    .header-hover-zone {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 20px;
      z-index: 60;
    }
    .header-hover-zone:hover + header.header-auto-hide,
    header.header-auto-hide:hover,
    header.header-auto-hide:focus-within,
    header.header-auto-hide:has([aria-expanded="true"]) {
      transform: translateY(0);
    }
  `],
  host: {
    style: 'display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden;'
  }
})
export class ShellLayoutComponent {
  private readonly _appSettings = inject(AppSettingsService);
  private readonly _breadcrumbService = inject(ErpBreadcrumbService);
  private readonly _navRegistry = inject(ErpNavRegistryService);
  private readonly _userPreferences = inject(ErpUserPreferencesService);
  private readonly _widgetRegistry = inject(ErpWidgetRegistryService);
  private readonly _jobService = inject(JobService);

  // ── Powiadomienia o zadaniach masowych ──

  /** Zadania, które zmieniły stan od ostatniego otwarcia panelu. */
  public readonly unreadJobs = this._jobService.unreadCount;

  /** Czy cokolwiek jeszcze się wykonuje — dzwonek zamienia wtedy ikonę na wskaźnik pracy. */
  public readonly hasActiveJobs = computed(() => this._jobService.activeCount() > 0);

  /**
   * Zawartość panelu powiadomień. `null` do pierwszego otwarcia dzwonka — komponent listy
   * mieszka w remocie `notification` i nie ma powodu ładować go przy starcie aplikacji.
   * Licznik przy dzwonku jest niezależny: karmi go `JobService`, zasilany przy STARTUP
   * przez `bootstrapJobFeed()`.
   */
  public readonly jobsWidget = signal<{ component: Type<unknown>; injector: Injector } | null>(null);

  public readonly notificationsOpen = signal(false);

  public readonly isDarkMode = this._appSettings.isDarkMode;
  public readonly navMenu = this._navRegistry.$navMenu;
  public readonly menuOpen = signal(false);
  public readonly headerMode = computed(() => this._userPreferences.headerMode ?? 'fixed');

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
    this.fontSizeControl.valueChanges.subscribe(val => {
      if (val) {
        this._userPreferences.setFontSize(val as 's' | 'm' | 'l' | 'xl');
      }
    });

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

  public readonly fontSizeControl = new FormControl(this._userPreferences.fontSize || 'm');

  public readonly fontSizeConfig = ErpToggleGroupBuilder.create(b => b
    .setMode('single')
    .setDirection('horizontal')
    .setSize('s')
    .addItem(i => i.setValue('s').setText('S'))
    .addItem(i => i.setValue('m').setText('M'))
    .addItem(i => i.setValue('l').setText('L'))
    .addItem(i => i.setValue('xl').setText('XL'))
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
        id: 'font-size',
        separator: true,
        component: ErpToggleGroupComponent,
        inputs: { 
          config: this.fontSizeConfig,
          control: this.fontSizeControl
        },
      },
      {
        id: 'language',
        separator: true,
        label: SHARED_KEYS.settings.language.title,
        icon: '@tui.globe',
        children: [
          {
            id: 'lang-pl',
            label: SHARED_KEYS.settings.language.pl,
            active: computed(() => this._appSettings.language() === 'pl-PL'),
            fn: () => this.setLanguage('pl-PL')
          },
          {
            id: 'lang-en',
            label: SHARED_KEYS.settings.language.en,
            active: computed(() => this._appSettings.language() === 'en-US'),
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
        id: 'header-mode',
        label: computed(() => this.headerMode() === 'fixed' ? SHARED_KEYS.settings.headerMode.autoHide : SHARED_KEYS.settings.headerMode.fixed),
        icon: computed(() => this.headerMode() === 'fixed' ? '@tui.pin-off' : '@tui.pin'),
        fn: () => this.toggleHeaderMode()
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
      .setComponent(ErpNavigationMenuComponent, { config: {items: this.navMenu, showSingle: true} })
      .setCloseOnNavigation(true)
      .setOnClose(() => this.menuOpen.set(false))
  );

  public toggleTheme(): void {
    this._appSettings.setDarkMode(!this.isDarkMode());
  }

  public toggleHeaderMode(): void {
    const current = this.headerMode();
    this._userPreferences.setHeaderMode(current === 'fixed' ? 'auto-hide' : 'fixed');
  }

  public setLanguage(lang: AppLanguage): void {
    this._appSettings.setLanguage(lang);
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

  /**
   * Otwarcie panelu powiadomień: dociąga komponent listy z remota (raz na sesję — rejestr
   * cache'uje wynik) i zeruje licznik nieprzeczytanych.
   *
   * Licznik zerujemy od razu, nie po załadowaniu widżetu: użytkownik już zobaczył, że coś
   * się wydarzyło, więc badge nie ma po co świecić, nawet gdyby remote był niedostępny.
   */
  public async openNotifications(): Promise<void> {
    this._jobService.markAllSeen();

    if (this.jobsWidget()) {
      return;
    }

    const widget = await this._widgetRegistry.load(JOB_LIST_WIDGET_ID);
    if (widget) {
      this.jobsWidget.set(widget);
    }
  }

  public openTasks(): void {
    console.log('Tasks clicked');
  }
}
