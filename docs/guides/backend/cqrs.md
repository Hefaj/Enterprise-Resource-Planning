---
id: backend.cqrs
title: CQRS — komendy i zapytania
summary: Komendy, handlery, zapytania, transakcje i idempotencja w pipeline CQRS.
kind: guide
scope: backend
audience:
  - backend
  - agent
triggers:
  - komenda lub zapytanie CQRS
  - pipeline komend i X-Request-Id
related: []
---

# CQRS — komendy i zapytania

**Stan: ✅ obie strony działają**, razem z pipeline'em komend (logowanie, walidacja wejścia,
jednostka pracy, idempotencja) — patrz sekcja 6.

Odczyt i zapis mają w tym systemie **osobne ścieżki, osobne modele i osobne zasady**. To nie jest
podział dla samego podziału — obie strony mają sprzeczne wymagania i próba obsłużenia ich jednym
modelem kończy się tym, że żadna nie działa dobrze.

---

## 1. Podział ról

| | Zapis (Command) | Odczyt (Query) |
|---|---|---|
| Wejście | `ICommand<T>` + `CommandHandler<,>` | Interfejs `IXxxQueries` |
| Dane | Pełny agregat, **ze śledzeniem zmian** | Projekcja wprost do DTO, `AsNoTracking` |
| Dostęp | Repozytorium (`IProductRepository`) | `DbContext` bezpośrednio |
| Reguły | W agregacie | Brak — odczyt niczego nie waliduje |
| Transakcja | `IUnitOfWork` | Brak |

**Strona odczytu świadomie omija repozytoria i agregaty.** Materializowanie pełnego agregatu tylko
po to, żeby zaraz spłaszczyć go do DTO, kosztuje przy listach po kilkaset pozycji i nie daje nic
w zamian. To jest cel rozdziału CQRS, a nie skrót.

---

## 2. Gdzie co mieszka

Cały kod grupowany jest wewnątrz warstw według agregatów (np. `Products`, `Categories`), aby uniknąć płaskiej i nieczytelnej struktury przy rozroście systemu.

```text
Catalog.Domain/
└── Aggregates/
    └── Products/
        ├── Product.cs                 # definicja agregatu i reguły biznesowe
        └── Events/                    # zdarzenia domenowe (np. ProductPriceChanged.cs)

Catalog.Application/
├── Abstractions/
│   └── IProductRepository.cs          # abstrakcja dostępu zapisu
└── Products/                          # wszystkie operacje na agregacie zebrane w jednym miejscu
    ├── Commands/                      # komendy (np. ProductSetPriceCommand.cs)
    ├── Handlers/                      # handlery komend
    ├── Dtos/                          # DTO — kontrakt HTTP, ZAMROŻONY (NSwag)
    ├── Queries/                       # interfejsy odczytu
    ├── Requests/                      # typy żądań — też kontrakt
    ├── Responses/                     # typy odpowiedzi
    └── Rules/                         # reguły walidacji (np. wsadowej)

Catalog.Infrastructure/
├── Persistence/
│   └── Configurations/
│       └── Products/                  # mapowania EF agregatu
├── Queries/                           # implementacje IXxxQueries (EF)
└── Repositories/                      # implementacje repozytoriów (EF)

Catalog.Api/
└── Products/
    ├── ProductGroup.cs                # prefiks trasy i wspólna konfiguracja grupy
    ├── Command/                       # endpointy — tłumaczą HTTP na komendę
    └── Query/                         # endpointy — tłumaczą HTTP na zapytanie
```

**Nazwa folderu agregatu jest ta sama we wszystkich czterech warstwach** i zawsze w liczbie
mnogiej (`Products`, `Categories`, `Codes`, `Models`, `Multimedia`, `Warranties`, `Attributes`) —
dzięki temu „gdzie jest reszta tego agregatu" sprowadza się do zamiany nazwy projektu w ścieżce.
Namespace idzie za folderem: `Catalog.Products` w Api, `Catalog.Application.Products`,
`Catalog.Domain.Products`.

Ten sam kształt mają **wszystkie moduły** — `Sales` (`Customers`) i `Notification` (`Jobs`) różnią
się tylko listą agregatów, więc wzorować się można na dowolnym z nich.

Poziom `Aggregates/` występuje **wyłącznie w Domain**, gdzie odróżnia agregaty od reszty warstwy.
W Api i Application folder agregatu leży bezpośrednio w korzeniu projektu — opakowanie, które
zawiera 100% zawartości, nic by nie rozróżniało. Z tego samego powodu `Catalog.Api/Jobs/`
(sterowanie zadaniami masowymi) stoi obok agregatów, chociaż agregatem Catalogu nie jest.

---

## 3. Komendy

```csharp
public sealed class ProductSetPriceCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }        // wymagane przez IAggregateCommand (operacje masowe)
    public decimal Price { get; set; }
}
```

> `ICommand<T>` i `CommandHandler<,>` pochodzą z pakietu FastEndpoints, ale są użyte **wyłącznie
> jako mediator in-process** — nie ma w nich nic z HTTP. Ta sama komenda jest wykonywana zarówno
> z endpointu, jak i z `BulkCommandRunner`, który o HTTP nie wie nic.

Handler jest cienki **z założenia**: wczytaj agregat, zawołaj metodę domenową, zapisz.

```csharp
public override async Task<Guid> ExecuteAsync(ProductSetPriceCommand command, CancellationToken ct)
{
    var product = await _repository.FindAsync(command.Uuid, ProductLoadScope.Root, ct)
        ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

    product.SetPrice(command.Price, _clock.UtcNow);      // reguła jest TUTAJ, nie w handlerze

    return product.Uuid;
}
```

Dwie rzeczy, które łatwo przeoczyć w tym przykładzie:

- **Handler NIE woła `SaveChangesAsync`.** Granicę transakcji wyznacza pipeline komend (§6):
  komenda wysłana pojedynczo zatwierdza się sama, a wywołujący, który chce jednej transakcji dla
  paczki komend (`BulkCommandRunner` dla chunka, `MultimediaCreateCommandEndpoint` dla wgranych
  plików), przejmuje granicę przez `ICommandDispatcher.OwnTransaction()` i zapisuje sam. To jedyny
  sposób, żeby operacja na 50 tys. produktów nie oznaczała 50 tys. transakcji.
- **`ProductLoadScope.Root`** mówi, ile agregatu wczytać — `SetPrice` dotyka jednej kolumny,
  więc pełny produkt z pięcioma kolekcjami byłby pięcioma zbędnymi zapytaniami. Handler
  deklaruje ten sam zakres w `PreloadAsync` (z `IBulkPreloadingHandler`), dzięki czemu cały
  chunk wczytuje się jednym zapytaniem — patrz
  [`bulk-commands.md`](bulk-commands.md#jeden-chunk--jedno-wczytanie).

**Handler nigdy nie ustawia właściwości agregatu z zewnątrz.** Gdyby walidacja ceny żyła w handlerze,
istniałaby w dwóch miejscach (handler pojedynczy + ścieżka masowa) i rozeszłaby się przy pierwszej zmianie.

### Reguła, na której opiera się cała reszta

**Metoda agregatu waliduje PRZED zmianą stanu.**

To nie jest kwestia stylu. Opiera się na tym `BulkCommandRunner`: skoro `DomainException` oznacza,
że nic się nie zmieniło, błąd jednego elementu nie zanieczyszcza transakcji i pozostałe elementy
chunka mogą się zapisać. Złamanie tej zasady w jednym agregacie psuje semantykę operacji masowych
dla całego modułu.

### Kody błędów

`DomainException` niesie `ErrorCode` w `snake_case` (`product_price_negative`, `category_name_empty`).
Nie jest ozdobnikiem — ląduje w `job_item.error_code` i pozwala pogrupować raport z operacji na
50 tys. pozycji po przyczynie („1200 × price_negative") zamiast wyświetlać 1200 wolnych tekstów.
Komunikat jest dla developera; tekst dla użytkownika frontend buduje z kodu przez Transloco.

### Brak `SaveAsync` w repozytorium

Zapis należy do `IUnitOfWork`, nie do repozytorium — żeby jedna komenda mogła dotknąć kilku
agregatów w jednej transakcji, a operacja masowa zatwierdzić cały chunk jednym commitem.

---

## 4. Zapytania

Interfejsy w `Application`, implementacje w `Infrastructure` — dzięki temu warstwa aplikacyjna
nie zna EF Core (pilnuje tego `Erp.ArchitectureTests`), a endpointy zależą od abstrakcji.

```csharp
public interface IProductQueries
{
    Task<SearchResponse> SearchAsync(SearchProductRequest request, CancellationToken ct);
    Task<List<ProductDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken ct);
    Task<List<Guid>> GetMatchingUuidsAsync(SearchProductRequest request, CancellationToken ct);
}
```

### Kontrakt „szukaj → uuid, potem pobierz po uuid"

`searchX` zwraca **wyłącznie identyfikatory i licznik**, nie pełne DTO. Wynika to wprost ze sposobu
działania frontendu: `BaseOrchestrator` trzyma agregaty w `IdentityMapStore`, więc po wyszukiwaniu
dociąga tylko te, których jeszcze nie ma w cache. Zwracanie pełnych DTO z wyszukiwania psułoby ten
mechanizm i przesyłało dane, które klient już ma.

`GetMatchingUuidsAsync` to ten sam filtr **bez stronicowania** — operacja masowa obejmuje cały
zbiór pasujący do filtra, nie jedną stronę.

### Trzy zasady pisania zapytań

1. **`Count` przed stronicowaniem.** `totalCount` opisuje cały zbiór wyników, nie stronę.

2. **Zawsze stabilne domknięcie sortowania.**

   ```csharp
   return ordered is null ? query.OrderBy(p => p.Uuid) : ordered.ThenBy(p => p.Uuid);
   ```

   Postgres nie gwarantuje kolejności wierszy o równych kluczach sortowania. Bez domknięcia
   ten sam produkt potrafi pojawić się na dwóch stronach albo zniknąć między nimi.

3. **Sortowanie po whiteliście, nigdy po nazwie pola z żądania.**

   ```csharp
   ordered = sort.Field.ToUpperInvariant() switch
   {
       "NAME" => Chain(ordered, query, p => p.Name, descending),
       "PRICE" => Chain(ordered, query, p => p.Price, descending),
       _ => ordered,
   };
   ```

   Nazwa pola przychodzi z żądania HTTP. Dynamiczne budowanie wyrażenia z niej otwiera drogę do
   sortowania po kolumnach, których API nie zamierzało wystawiać.

### Projekcje muszą być wyrażeniami

EF tłumaczy na SQL **drzewo wyrażeń**, nie wywołania metod. Projekcja wyliczająca metadane
przez podzapytania musi więc być `Expression<Func<T, TDto>>`, a nie zwykłą metodą:

```csharp
private Expression<Func<Category, CategoryTreeNodeDto>> TreeNodeProjection
    => c => new CategoryTreeNodeDto(
        c.Uuid, c.Name, c.ParentUuid,
        _dbContext.Categories.Any(x => x.ParentUuid == c.Uuid),
        _dbContext.Categories.Count(x => x.ParentUuid == c.Uuid),
        _dbContext.CategoryClosure.Count(e => e.AncestorUuid == c.Uuid && e.Depth > 0));
```

Statyczny helper wywołany w `Select(...)` skompiluje się, ale wywali się w czasie działania —
albo, gorzej, wciągnie całą tabelę do pamięci.

---

## 5. Endpointy

Endpoint tłumaczy HTTP na komendę/zapytanie i **nic więcej**:

```csharp
public sealed class SearchProductEndpoint : Endpoint<SearchProductRequest, SearchResponse>
{
    private readonly IProductQueries _queries;
    public SearchProductEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchProduct");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(SearchProductRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.SearchAsync(req, ct), ct);
}
```

**Nazwa klasy endpointu jest częścią kontraktu.** `UseErpApi` obcina sufiks `Endpoint`
i ustawia to jako nazwę operacji, z której NSwag generuje nazwę metody klienta:
`SearchProductEndpoint` → `searchProduct`. Przemianowanie klasy psuje frontend.

To samo dotyczy **nazw klas komend** — `ProductSetPriceCommand` generuje typ
`BatchCommandOfProductSetPriceCommandAndSearchProductRequest`, importowany wprost przez
`catalog-product.orchestrator.ts`.

---

## 6. Pipeline komend

Każda komenda — wysłana żądaniem HTTP i wykonana jako element zadania masowego — przechodzi
przez ten sam łańcuch. Dyspozytorem jest `ICommandDispatcher`, a nie `command.ExecuteAsync(ct)`
z FastEndpoints: tamta szyna rozwiązuje handler z *root* providera (poza żądaniem HTTP nie ma
z czego wstrzyknąć niczego scoped) i nie ma w niej miejsca, w które dałoby się wpiąć cokolwiek.

```csharp
var uuid = await _dispatcher.SendAsync<ProductSetPriceCommand, Guid>(command, ct);
```

Ogniwa, w kolejności od zewnętrznego (kolejność = kolejność rejestracji w `AddErpCommands`):

| # | Ogniwo | Co robi | Dlaczego tu, a nie gdzie indziej |
|---|---|---|---|
| 1 | `LoggingCommandMiddleware` | Co, kto, korelacja, czas, skutek | Musi objąć też komendy odrzucone przez walidację i powtórki oddane z rejestru — czyli dokładnie te przypadki, dla których zagląda się do logu |
| 2 | `ValidationCommandMiddleware` | `IValidator<TCommand>` (FluentValidation), komplet naruszeń naraz | Przed czymkolwiek, co dotyka bazy: komenda z ujemną ceną nie ma po co otwierać transakcji |
| 3 | `UnitOfWorkCommandMiddleware` | `SaveChangesAsync` po komendzie, która jest właścicielem transakcji | Wyznacza granicę, w której musi się zmieścić ogniwo 4 |
| 4 | `IdempotencyCommandMiddleware` | `X-Request-Id` → wynik pierwszego wykonania | **Wewnątrz** jednostki pracy — patrz niżej |
| — | handler komendy | Reguła w agregacie | |

Mapowanie wyjątku na `ProblemDetails` **nie jest ogniwem pipeline'u**, tylko
`IExceptionHandler` na granicy HTTP (`ErpProblemDetailsHandler`, podpięty w `UseErpApi`).
Wyjątek z komendy jedzie dwiema drogami — do odpowiedzi HTTP i do `job_item.error_code` —
a tłumaczenie na status HTTP ma sens tylko na pierwszej z nich.

| Wyjątek | Status | `type` / `errorCode` |
|---|---|---|
| `CommandValidationException` | 400 | `command_invalid` + `errors` per pole |
| `AggregateNotFoundException` | 404 | `aggregate_not_found` |
| `DomainException` | 422 | kod reguły (`price_negative`…) |
| `DbUpdateConcurrencyException` | 409 | `concurrency_conflict` |
| naruszenie klucza idempotencji | 409 | `request_duplicate` |
| `DbUpdateException` rozpoznany przez `IPersistenceExceptionTranslator` | 422 | kod reguły |
| reszta | 500 | `internal_error` (bez treści wyjątku poza Development) |

To ten sam słownik kodów, którym opisane są elementy zadań masowych, więc frontend tłumaczy
obie drogi jednym rejestrem (`shared.errors.codes`).

### Granica transakcji: kto zatwierdza

Domyślnie zatwierdza sama komenda. Wywołujący, który potrzebuje jednej transakcji dla paczki
komend, deklaruje to jawnie:

```csharp
using (_dispatcher.OwnTransaction())
{
    foreach (var command in req.Commands)
    {
        uuids.Add(await _dispatcher.SendAsync<MultimediaCreateCommand, Guid>(command, ct));
    }

    await _unitOfWork.SaveChangesAsync(ct);   // wszystko albo nic
}
```

Robią to dziś dwa miejsca i oba mają na to twardy powód: `MultimediaCreateCommandEndpoint`
(katalog z połową wgranej galerii jest gorszy niż odrzucenie całości) i `BulkCommandRunner`
(chunk to jeden commit — na tym stoi wznawianie zadania po restarcie).

### Idempotencja — dlaczego wewnątrz jednostki pracy

Szkic tej sekcji stawiał idempotencję **przed** jednostką pracy. Jest odwrotnie i to jest jedyne
odstępstwo od pierwotnego planu: klucz musi zostać zatwierdzony **tym samym commitem** co skutek
komendy. Zapisany osobno wcześniej blokowałby operację, która ostatecznie się nie wykonała;
zapisany osobno później zostawiałby okno, w którym powtórka wykonuje wszystko drugi raz.

- **Klucz podaje klient** nagłówkiem `X-Request-Id`; bez nagłówka mechanizm jest bezczynny.
  Serwer nie ma jak odróżnić świadomego powtórzenia operacji od ponowienia po zerwanym
  połączeniu — z treści żądania to nie wynika, więc zgadywanie blokowałoby to pierwsze.
- **Postać klucza**: `{requestId}:{nazwa operacji}[:{uuid agregatu}]`. Nazwa operacji rozdziela
  żądania jednej operacji złożonej (rejestracja plików → dopięcie ich do produktów idą pod tym
  samym identyfikatorem z frontu), uuid agregatu rozdziela komendy jednej paczki.
- **Trwałość**: tabela `idempotency_key` w schemacie modułu, wpis wygasa po dobie
  (`Commands:IdempotencyRetention`), sprząta `IdempotencyCleanupService`. Rejestr w pamięci
  procesu znikałby przy restarcie i przy drugiej instancji — czyli dokładnie wtedy, kiedy
  klient ponawia.
- **Obejmuje też zlecanie operacji masowych** (`JobStore.CreateAsync`): powtórzone żądanie
  oddaje `jobUuid` pierwszego zadania zamiast tworzyć drugie na tych samych 50 tys. pozycji.
- **Czego nie łapie**: dwóch RÓWNOLEGŁYCH żądań z tym samym kluczem. Żadne nie widzi jeszcze
  cudzego wpisu, więc oba wykonają komendę, a przegrany rozbije się o klucz główny i dostanie
  `409 request_duplicate`. Sekwencyjne ponowienie — czyli przypadek, dla którego to powstało —
  obsłużone jest w pełni.

Front wysyła nagłówek wyłącznie wewnątrz `withRequestId(...)` (`@erp/shared/data-access`),
którym owinięte są ścieżki zapisu w orkiestratorach. Poza tym zakresem identyfikator byłby inny
przy każdej próbie, więc nie chroniłby przed niczym, a rejestr rósłby o wiersz na każdy zapis
w systemie.

### Walidacja wejścia nie zastępuje reguł w agregacie

`IValidator<TCommand>` sprawdza **kształt komendy** (wymagalność, zakresy, długości) — to, co da
się rozstrzygnąć bez sięgania do bazy. Reguła zależna od stanu modelu zostaje w agregacie, bo
tylko tam da się ją wymusić bez wyścigu; reguła zbiorcza zostaje w pre-checku wsadowym
([`batch-validation.md`](batch-validation.md)). Komenda bez walidatora przechodzi bez kosztu —
walidator jest dokładany tam, gdzie ma sens, a nie obowiązkiem przy każdej komendzie.

Kod błędu podany przez `WithErrorCode("amount_negative")` jest kontraktem z frontendem; domyślne
kody FluentValidation (`NotEmptyValidator`) nim nie są i celowo nie wychodzą na zewnątrz —
zamiast nich klient dostaje `command_invalid`.

`CommandValidationException` **dziedziczy po `DomainException`** i to jest decyzja, nie skrót:
ta sama komenda bywa elementem zadania masowego, gdzie odrzucenie ma zachować się jak każde inne
naruszenie reguły (element odpada, chunk idzie dalej). Wyjątek spoza tej gałęzi wywracałby
transakcję całego chunka z powodu jednego źle wypełnionego pola.

---

## 7. Zobacz też

- [Operacje masowe](bulk-commands.md) — jak ta sama komenda jest wykonywana zbiorczo
- [Walidacja wsadowa](batch-validation.md) — reguły zbiorcze uruchamiane PRZED utworzeniem
  zadania, dopełnienie walidacji w agregacie dla przypadków, których nie da się sprawdzić
  per pojedynczy element bez N zapytań
- [Zdarzenia domenowe i outbox](../../architecture/integration-events.md) — co się dzieje przy `SaveChangesAsync`
- [Persystencja](persistence-ef.md)
