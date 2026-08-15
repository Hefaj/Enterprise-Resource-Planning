import type { Injector, Provider, Type } from '@angular/core';

/**
 * Komponenty tego remota osadzane przez HOSTA poza jego własnymi trasami.
 *
 * Host ma dziś dwie ścieżki po zawartość remota: trasy (`remoteRoutes`) i modale
 * (`registerModals`). Lista zadań w nagłówku nie jest ani jednym, ani drugim — to widżet
 * wstawiany w cudzy layout — więc dostaje trzecią, celowo minimalną: funkcję zwracającą
 * klasę komponentu i jego providery.
 *
 * Wszystko idzie przez `import()` w środku funkcji, nie przez statyczny re-eksport. Kontrakt
 * jest ładowany przy STARTUP dla menu, więc statyczny `export { JobListComponent } from
 * '@erp/notification/feature'` (tak było wcześniej) wciągałby całą warstwę feature razem
 * z TaigaUI do bundla startowego — dla ekranu, którego użytkownik może nigdy nie otworzyć.
 */
export async function loadJobListComponent(): Promise<{
  component: Type<unknown>;
  providers: Provider[];
}> {
  const [{ JobListComponent }, { provideJobTranslations }] = await Promise.all([
    import('@erp/notification/feature'),
    import('@erp/notification/ui'),
  ]);

  // Providery wracają razem z komponentem, bo host nie ma jak ich znać: scope Transloco
  // `job` żyje w tym module. Host wstawia je do injectora widżetu — nie do własnego,
  // globalnego (patrz ostrzeżenie o DI shadowing w docs/frontend/translations.md).
  return { component: JobListComponent, providers: provideJobTranslations() };
}

/**
 * Startuje zasilanie feedu zadań danymi z serwera.
 *
 * Wołane przez hosta przy STARTUP, bo licznik przy dzwonku musi być prawdziwy, zanim
 * ktokolwiek kliknie — a dopóki nikt nie kliknie, komponent listy nie jest ładowany.
 * Sam serwis jest lekki (klient HTTP + orkiestrator), więc koszt to jedno zapytanie
 * `searchJob` przy starcie sesji.
 *
 * Injector przychodzi parametrem, a nie przez `inject()`: funkcja jest asynchroniczna,
 * a kontekst wstrzykiwania nie przeżywa pierwszego `await` — wywołujący musi go pobrać
 * synchronicznie i podać tutaj.
 */
export async function bootstrapJobFeed(injector: Injector): Promise<void> {
  const { JobFeedService } = await import('@erp/notification/data-access');

  await injector.get(JobFeedService).bootstrap();
}
