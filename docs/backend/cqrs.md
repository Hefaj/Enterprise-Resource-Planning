# CQRS — komendy i zapytania

**Stan: strona odczytu ✅, strona zapisu 🟡** (kod istnieje, `IUnitOfWork` niepodpięty — patrz
[`architecture.md`](./architecture.md#1-stan-wdrożenia)).

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

```
Catalog.Application/
├── Contracts/
│   ├── CatalogDtos.cs         # DTO — kontrakt HTTP, ZAMROŻONY (NSwag)
│   ├── CatalogRequests.cs     # typy żądań — też kontrakt
│   └── ICatalogQueries.cs     # interfejsy odczytu
├── Abstractions/
│   └── IProductRepository.cs  # dostęp zapisu
└── Products/
    └── ProductCommands.cs     # komendy + handlery

Catalog.Infrastructure/
├── Queries/                   # implementacje IXxxQueries (EF)
└── Repositories/              # implementacje repozytoriów (EF)

Catalog.Api/
└── Product/{Query,Command}/   # endpointy — tłumaczą HTTP na komendę/zapytanie
```

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
    var product = await _repository.FindAsync(command.Uuid, ct)
        ?? throw new AggregateNotFoundException(nameof(Product), command.Uuid);

    product.SetPrice(command.Price, _clock.UtcNow);      // reguła jest TUTAJ, nie w handlerze

    await _unitOfWork.SaveChangesAsync(ct);
    return product.Uuid;
}
```

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
       "SKU" => Chain(ordered, query, p => p.Sku, descending),
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

## 6. Czego jeszcze nie ma

Plan przewiduje middleware komend (`ICommandMiddleware`) w kolejności: logowanie → walidacja
(FluentValidation) → idempotencja (`X-Request-Id`) → jednostka pracy → mapowanie wyjątków
na `ProblemDetails`. **Nie jest zaimplementowane.** Dziś handler sam woła `IUnitOfWork`,
a walidacja żyje wyłącznie w agregacie.

---

## 7. Zobacz też

- [Operacje masowe](./bulk-commands.md) — jak ta sama komenda jest wykonywana zbiorczo
- [Zdarzenia domenowe i outbox](./events-outbox.md) — co się dzieje przy `SaveChangesAsync`
- [Persystencja](./persistence-ef.md)
