import { Component, signal, inject, computed, effect, Injector, Type } from '@angular/core';
import { Router, RouterOutlet, RouterModule } from '@angular/router';
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
  UserNotificationService,
  ErpDocumentationRegistryService,
  ErpLanguageService,
  JOB_LIST_WIDGET_ID,
  USER_NOTIFICATION_WIDGET_ID,
  ERP_LOGOUT_HANDLER,
} from '@erp/shared/data-access';
import { AppSettingsService } from '@erp/client/util';
import { ErpSettingsMenuComponent, ErpSettingsMenuConfig, ErpSettingsMenuItem, ErpCompanySelectorComponent, ErpUpdateIndicatorComponent, ErpNotificationsComponent, ErpTasksComponent, ErpNavigationMenuComponent, ErpUserBadgeComponent } from '@erp/client/ui';
import { ErpToggleGroupComponent, ErpToggleGroupBuilder } from '@erp/shared/ui';
import { ErpAuthService } from '@erp/shared/auth';

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
    ErpUserBadgeComponent,
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
  private readonly _userNotifications = inject(UserNotificationService);
  private readonly _logoutHandler = inject(ERP_LOGOUT_HANDLER);
  private readonly _authService = inject(ErpAuthService);
  private readonly _router = inject(Router);
  private readonly _documentationRegistry = inject(ErpDocumentationRegistryService);
  private readonly _language = inject(ErpLanguageService);
  private _documentationLocale = this._language.language();

  /** Zalogowany użytkownik — pokazywany w nagłówku (`erp-user-badge`). `null` w krótkim oknie
   * między startem appki a odczytaniem danych z tokenu, choć guard tras i tak nie wpuszcza tu
   * nikogo niezalogowanego, więc w praktyce zawsze ma wartość. */
  public readonly currentUser = this._authService.$currentUser;

  // ── Powiadomienia o zadaniach masowych ──

  /** Zadania, które zmieniły stan od ostatniego otwarcia panelu — badge przycisku `erp-tasks`. */
  public readonly unreadJobs = this._jobService.unreadCount;

  /** Nieprzeczytane powiadomienia osobiste (Faza 5, `UserNotification`) — badge dzwonka
   * `erp-notifications`. Niezależny licznik, osobny widżet — patrz docs/guides/frontend/notifications.md §10.1. */
  public readonly unreadNotificationsCount = this._userNotifications.unreadCount;

  /** Czy cokolwiek jeszcze się wykonuje — przycisk zadań zamienia wtedy ikonę na wskaźnik pracy. */
  public readonly hasActiveJobs = computed(() => this._jobService.activeCount() > 0);

  /**
   * Zawartość panelu zadań masowych. `null` do pierwszego otwarcia — komponent listy mieszka
   * w remocie `notification` i nie ma powodu ładować go przy starcie aplikacji. Licznik przy
   * przycisku jest niezależny: karmi go `JobService`, zasilany przy STARTUP przez `bootstrapJobFeed()`.
   */
  public readonly tasksWidget = signal<{ component: Type<unknown>; injector: Injector } | null>(null);

  /** Zawartość panelu powiadomień — jak wyżej, ale dla `UserNotificationService`/`erp-notifications`. */
  public readonly notificationsWidget = signal<{ component: Type<unknown>; injector: Injector } | null>(null);

  public readonly notificationsOpen = signal(false);

  public readonly tasksOpen = signal(false);

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
      fn: (): void => this._selectedDataLang.set(lang.code)
    }));
  });

  public constructor() {
    effect(() => {
      const locale = this._language.language();
      if (locale === this._documentationLocale) return;
      this._documentationRegistry.clearLocale(this._documentationLocale);
      this._documentationLocale = locale;
    });

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
        id: 'help',
        label: SHARED_KEYS.documentation.help,
        icon: '@tui.circle-question-mark',
        fn: () => this.openContextHelp(),
      },
      {
        id: 'theme',
        separator: true,
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
        fn: () => this.reportIssue()
      },
      {
        id: 'logout',
        label: SHARED_KEYS.settings.logout,
        icon: '@tui.log-out',
        separator: true,
        fn: () => this.logout()
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

  public logout(): void {
    void this._logoutHandler();
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
   * Otwiera artykuł przypisany do najgłębszej aktywnej trasy. Gdy ekran nie ma własnego
   * mapowania, prowadzi do przeglądu dokumentacji modułu, a poza modułem — do centrum pomocy.
   */
  public async openContextHelp(): Promise<void> {
    const routePrefix = this._router.url.split(/[/?#]/).filter(Boolean)[0];
    const descriptor = this._documentationRegistry.modules()
      .find((module) => module.routePrefix === routePrefix);

    if (!descriptor) {
      await this._router.navigate(['/help']);
      return;
    }

    let snapshot = this._router.routerState.snapshot.root;
    while (snapshot.firstChild) snapshot = snapshot.firstChild;
    const articleId = typeof snapshot.data['documentationArticleId'] === 'string'
      ? snapshot.data['documentationArticleId']
      : descriptor.overviewArticleId;
    const loaded = await this._documentationRegistry.loadIndex(descriptor, this._language.language());
    const article = loaded.entries.find((entry) => entry.articleId === articleId)
      ?? loaded.entries.find((entry) => entry.articleId === descriptor.overviewArticleId);

    if (!article) {
      await this._router.navigate(['/help']);
      return;
    }

    await this._router.navigate(['/', descriptor.routePrefix, 'documentation', article.slug]);
  }

  /**
   * Otwarcie panelu powiadomień: dociąga komponent listy z remota (raz na sesję — rejestr
   * cache'uje wynik). Licznik nieprzeczytanych powiadomień gaśnie wyłącznie przez jawną akcję
   * użytkownika w panelu (`markRead`/`markAllReadAsync`) — `UserNotificationService` nie ma
   * odpowiednika `JobService.markAllSeen()` (patrz docs/guides/frontend/notifications.md §10.2).
   */
  public async openNotifications(): Promise<void> {
    if (this.notificationsWidget()) {
      return;
    }

    const widget = await this._widgetRegistry.load(USER_NOTIFICATION_WIDGET_ID);
    if (widget) {
      this.notificationsWidget.set(widget);
    }
  }

  /**
   * Otwarcie panelu zadań masowych: dociąga komponent listy z remota (raz na sesję — rejestr
   * cache'uje wynik) i zeruje licznik nieprzeczytanych zadań.
   *
   * Licznik zerujemy od razu, nie po załadowaniu widżetu: użytkownik już zobaczył, że coś
   * się wydarzyło, więc badge nie ma po co świecić, nawet gdyby remote był niedostępny.
   */
  public async openTasks(): Promise<void> {
    this._jobService.markAllSeen();

    if (this.tasksWidget()) {
      return;
    }

    const widget = await this._widgetRegistry.load(JOB_LIST_WIDGET_ID);
    if (widget) {
      this.tasksWidget.set(widget);
    }
  }
}
