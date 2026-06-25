# Tworzenie Orkiestratora (Data Access)

Orkiestratory w warstwie `data-access` stanowią serce zarządzania stanem dla agregatów domenowych. Zarządzają inteligentnym pobieraniem danych, pamięcią podręczną (`IdentityMapStore`), subskrypcją na powiadomienia z SignalR oraz transformacją obiektów `DTO` na modele widokowe (`ViewModel`).

Poniżej znajdują się zasady i konwencje ich tworzenia.

## 1. Wzorzec Bazowy
Każdy orkiestrator musi dziedziczyć z abstrakcyjnej klasy `BaseOrchestrator<TDto, TViewModel, TFilters, TLoadOptions>`.
Orkiestratory to serwisy Angularowe typu Singleton i powinny posiadać adnotację `@Injectable({ providedIn: 'root' })`.

## 2. Wymagane Implementacje
Klasa dziedzicząca musi definiować następujące elementy:
- **`signature`**: Unikalny string identyfikujący orkiestrator (np. `'catalog.product'`).
- **`orchestratorConfig`**: Konfiguracja określająca m.in. sygnaturę dla SignalR oraz maksymalny rozmiar cache (`maxCacheSize`).
- **`fetchByUuids(uuids)`**: Metoda pobierająca obiekty DTO przez API (np. za pomocą klienta wygenerowanego przez NSwag).
- **`searchByFilters(filters)`**: Metoda wyszukująca i zwracająca obiekty typu `SearchResponse`.
- **`mapToViewModel(dto, resolvedDeps)`**: Czysta funkcja transformująca surowe DTO (wraz z rozwiązanymi zależnościami) w bogaty `ViewModel`.

## 3. Zależności i Eager Loading
Wiele agregatów (np. `Product`) zawiera powiązania do innych agregatów (np. `Category` czy `Model`). Do asynchronicznego ładowania powiązań należy:
- Zaimplementować opcjonalną metodę **`resolveEagerDependencies(uuids, options)`**.
- Zbierać UUID powiązanych obiektów z załadowanych DTO i wywoływać na zaprzyjaźnionych orkiestratorach metodę asynchronicznego ładowania (np. `loadAsync(...)`).

> [!IMPORTANT]
> **Używaj standardowego `LoadOptions` przy braku relacji:**
> Jeśli agregat nie posiada żadnych zależności wymagających dociągnięcia, nie twórz dedykowanego interfejsu opcji ładowania (np. `NotificationJobLoadOptions`). Zamiast tego użyj bezpośrednio ogólnego typu `LoadOptions` zaimportowanego z `@erp/shared/data-access` w definicji klasy orkiestratora:
> ```typescript
> export class NotificationJobOrchestrator extends BaseOrchestrator<JobDto, JobVM, SearchJobRequest, LoadOptions>
> ```

## 4. Zapobieganie cyklicznemu wstrzykiwaniu (Circular Dependency Guard)
Orkiestratory często potrzebują siebie nawzajem (np. orkiestrator Produktu musi dociągnąć Kategorie). Aby uniknąć błędów wstrzykiwania zależności w Angularze:
- Zależne orkiestratory wstrzykuj leniwie z użyciem `Injector`.
- Przykład:
  ```typescript
  private readonly _injector = inject(Injector);
  private _categoryOrchestrator: CatalogCategoryOrchestrator | null = null;

  private get _categorySiblingOrchestrator(): CatalogCategoryOrchestrator {
    if (!this._categoryOrchestrator) {
      this._categoryOrchestrator = this._injector.get(CatalogCategoryOrchestrator);
    }
    return this._categoryOrchestrator;
  }
  ```

## 5. View-Models
Dla każdego agregatu powinny zostać zdefiniowane modele widokowe (w pliku np. `product.view-model.ts`). `ViewModel` to typ rozszerzający interfejs `Dto`, który zamiast samych list/obiektów identyfikatorów (`categoryUuids`) przechowuje całe zagnieżdżone powiązane zasoby (np. `categories: CategoryVM[]`).

> [!TIP]
> **Dobre praktyki lintera:**
> - Jeśli `ViewModel` nie posiada żadnych dodatkowych pól w porównaniu do bazowego `Dto`, należy zdefiniować go jako alias typu (np. `export type JobVM = JobDto;`), a nie jako pusty interfejs (np. `export interface JobVM extends JobDto {}`). Uniknie to błędu lintera `@typescript-eslint/no-empty-interface` / `@typescript-eslint/no-empty-object-type`.
> - W metodzie `mapToViewModel` jeśli nie ma zależności do zmapowania, można całkowicie pominąć parametr `resolvedDeps`, aby zapobiec ostrzeżeniom o nieużywanych zmiennych (`@typescript-eslint/no-unused-vars`).

Aby zasilić te pola, nadpisujemy metodę rozwiązywania zależności tak by odczytywała gotowe dane z cache zaprzyjaźnionych orkiestratorów. Należy do tego użyć własnej implementacji mapowania lub w razie wsparcia przez implementację bazową `_resolveCurrentDeps(dto)`.

## 6. Realizacja Komend
Metody do masowych aktualizacji bądź działań na zasobach tworzy się jako publiczne funkcje orkiestratora. Należy wtedy posługiwać się metodą `executeCommand(...)` pochodzącą z klasy bazowej, która wspiera system kolejkowania (JobService):
```typescript
public async setPriceMultiple(command: BatchCommand, queueID?: string): Promise<string> {
  const apiCall = () => this._api.productSetPriceCommand(command).pipe(map(res => res.jobUuid || ''));
  return this.executeCommand('Ustawianie cen', apiCall, undefined, queueID);
}
```
