# Walidacja wsadowa (batch validation)

**Stan: ✅ działa.** Mechanizm wspólny (`Erp.BuildingBlocks.Validation`), pierwsze podpięcie
w Catalog — `ProductMustExistRule` jako pre-check dla `product/batch-set-price` i
`product/batch-set-name`. Zweryfikowane end-to-end na żywym Catalog.Api + Postgres: cel
nieistniejący w bazie dostaje `job_item.status = Failed`, `error_code = aggregate_not_found`,
`attempts = 1` **natychmiast po utworzeniu zadania**, zanim `BulkCommandRunner` w ogóle
je zobaczy.

---

## 1. Po co to istnieje

[`cqrs.md`](./cqrs.md#3-komendy) i [`bulk-commands.md`](./bulk-commands.md) opisują już jedną
warstwę walidacji: **metoda agregatu waliduje przed zmianą stanu**, a `DomainException` jednego
elementu nie przerywa chunka operacji masowej. To działa dobrze dla reguł, które dotyczą
WYŁĄCZNIE jednego agregatu naraz (cena nieujemna, nazwa niepusta).

Nie działa dobrze dla reguł, które z natury są **zbiorcze** — „czy ten SKU nie jest duplikatem
w bazie", „czy wszystkie te 5000 kategorii istnieje i jest aktywnych". Walidacja per agregat
oznaczałaby jedno zapytanie do bazy na element; przy operacji masowej na kilku tysiącach celów
to kilka tysięcy zapytań, z których każde i tak kończy się tym samym wynikiem dla całej klasy
elementów. Batch validation istnieje po to, żeby taką regułę dało się sprawdzić **jednym
zapytaniem na cały wsad**, a wynik rozdzielić z powrotem po elementach.

Drugi powód: uruchomienie tego PRZED utworzeniem zadania (`job`/`job_item`) oznacza, że
oczywiście błędne cele nigdy nie trafiają do `BulkCommandRunner` — użytkownik dostaje
informację o odrzuceniu razem z `jobUuid`, zamiast czekać na `IdlePollingInterval` rundy
runnera, żeby dowiedzieć się tego samego.

---

## 2. Trzy elementy (`Erp.BuildingBlocks.Validation`)

Building block bez żadnych zależności (jak `Erp.BuildingBlocks.Domain`) — może go referencować
warstwa `Application` dowolnego modułu.

### `ValidationTracker`

Zbiornik błędów grupowany po identyfikatorze agregatu (`Guid`, nie `int` — w tym systemie
agregaty mają identyfikator `Guid`).

```csharp
public sealed class ValidationTracker
{
    public IReadOnlyDictionary<Guid, List<ValidationError>> Errors { get; }
    public void AddError(Guid aggregateUuid, string errorCode, string errorMessage);
    public bool HasError(Guid aggregateUuid);
}
```

`ErrorCode` jest z tej samej rodziny co `DomainException.ErrorCode` (`snake_case`) — dzięki
temu odrzucenie z pre-checku i porażka z `BulkCommandRunner` lądują w **tym samym** raporcie
(`job.errors_summary`) i grupują się identycznie.

### `IBatchRule<T>`

Jedna reguła, jedna klasa, testowalna bez mockowania całego pipeline'u:

```csharp
public interface IBatchRule<T>
{
    Task ExecuteAsync(
        IReadOnlyList<T> items,
        Func<T, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken);
}
```

`T` to lekki typ wsadu — sam `Guid` (jak w `ProductMustExistRule`), albo bogatsze DTO, jeśli
reguła potrzebuje więcej niż samego identyfikatora. `idSelector` jest przekazywany z zewnątrz
(przez `ValidationChain<T>` albo bezpośrednio przez wywołującego), więc ta sama reguła działa
niezależnie od tego, jaki dokładnie kształt ma `T`.

Implementacja żyje w `Application` modułu i dostaje dane przez **dedykowany interfejs
odczytowy** (np. `IProductQueries.GetExistingUuidsAsync`), nie przez surowy `DbContext` —
`Application` nie zna EF Core, tę granicę pilnuje `Erp.ArchitectureTests`, tak samo jak dla
reszty strony odczytu CQRS (patrz [`cqrs.md`](./cqrs.md#4-zapytania)).

```csharp
public sealed class ProductMustExistRule : IBatchRule<Guid>
{
    public async Task ExecuteAsync(
        IReadOnlyList<Guid> items, Func<Guid, Guid> idSelector,
        ValidationTracker tracker, CancellationToken ct)
    {
        var existing = new HashSet<Guid>(await _queries.GetExistingUuidsAsync(items, ct));
        foreach (var item in items)
        {
            var uuid = idSelector(item);
            if (!existing.Contains(uuid))
            {
                tracker.AddError(uuid, "aggregate_not_found", $"Nie znaleziono produktu {uuid}.");
            }
        }
    }
}
```

### `ValidationChain<T>` — tryb łańcucha

Dla reguł **silnie zależnych** — Chain of Responsibility / Pipes and Filters. Element, który
nie przejdzie kroku, jest odfiltrowywany i kolejne reguły w łańcuchu go ignorują:

```csharp
var chain = new ValidationChain<ProductDto>(p => p.Uuid)
    .AddRule(new CategoryMustExistRule(_categoryQueries))
    .AddRule(new CategoryMustBeActiveRule(_categoryQueries));

await chain.RunAsync(batch, tracker, ct);
```

`CategoryMustBeActiveRule` może bezpiecznie założyć, że kategoria istnieje — element, dla
którego to nieprawda, nigdy do niej nie dotrze. To jest ochrona przed wyjątkami technicznymi
(np. `NullReferenceException`), nie przed naruszeniami biznesowymi — te i tak trafiają do
`ValidationTracker`, nie są rzucane jako wyjątki.

### Tryb niezależnych reguł — bez łańcucha

Dla reguł płaskich, gdzie zależy na zebraniu WSZYSTKICH naruszeń dla elementu naraz —
`ValidationChain` jest wtedy zbędny, woła się reguły bezpośrednio, po kolei, na tej samej
pełnej liście wejściowej:

```csharp
await priceRule.ExecuteAsync(batch, idSelector, tracker, ct);
await nameRule.ExecuteAsync(batch, idSelector, tracker, ct);
```

`ValidationTracker` mieści wiele błędów na element (`List<ValidationError>`) właśnie z myślą
o tym trybie. Przy zamianie na `job_item.error_code` (który mieści tylko jeden kod) wygrywa
**pierwszy zarejestrowany** błąd — patrz sekcja 3.

---

## 3. Podpięcie w `BatchEndpointBase<TCommand, TFilter>`

Pre-check jest wbudowany w bazę operacji masowych, więc dotyczy **każdego** modułu, nie tylko
Catalogu — domyślnie no-op:

```csharp
protected virtual Task<ValidationTracker> ValidateTargetsAsync(
    IReadOnlyList<Guid> aggregateUuids, CancellationToken ct)
    => Task.FromResult(new ValidationTracker());
```

`HandleAsync` woła go PO rozwiązaniu trzech trybów kontraktu (`Commands` / szablon+uuidy /
szablon+filtr) na listę `JobTarget`, a PRZED `IJobStore.CreateAsync`. Tracker zamienia się na
`IReadOnlyDictionary<Guid, (string ErrorCode, string ErrorMessage)>` (pierwszy błąd na element
wygrywa) i leci do `Job.Create` jako `preValidatedFailures`.

`Job.Create` od razu oznacza pasujące elementy jako `JobItemStatus.Failed`
(`maxAttempts: 1` — to nie jest błąd przejściowy do ponowienia, tylko ostateczne odrzucenie
sprzed startu zadania) i liczy `job.FailedCount` po fakcie utworzenia elementów.

**`BulkCommandRunner` nie wymagał ŻADNEJ zmiany.** Element bez statusu `Pending` po prostu nie
pojawia się w jego zapytaniu o kolejny chunk (`WHERE Status = Pending`). Zadanie, w którym
WSZYSTKIE elementy odpadły na pre-checku, ma `RemainingCount == 0` od razu po utworzeniu —
runner zamyka je (`FinishJobAsync` → `job.Complete()`) przy najbliższym przebiegu pętli, tak
samo jak zadanie, które właśnie skończyło ostatni chunk.

### Konkretny przykład: Catalog

```csharp
protected override async Task<ValidationTracker> ValidateTargetsAsync(
    IReadOnlyList<Guid> aggregateUuids, CancellationToken ct)
{
    var tracker = new ValidationTracker();
    await _productMustExistRule.ExecuteAsync(aggregateUuids, uuid => uuid, tracker, ct);
    return tracker;
}
```

Podpięte w `ProductSetPriceMultipleCommandEndpoint` i `ProductSetNameMultipleCommandEndpoint`.
`ProductMustExistRule` jest zarejestrowana w DI (`Program.cs`, `AddScoped<ProductMustExistRule>()`)
i wstrzyknięta do obu endpointów konstruktorowo, tak jak `IProductQueries`.

---

## 4. Czego (świadomie) tu nie ma

- **Walidacja payloadu komendy** (np. „cena musi być dodatnia") nie korzysta z tego mechanizmu
  dla dwóch istniejących komend masowych Catalogu — w trybie szablonu ta sama wartość dotyczy
  WSZYSTKICH celów naraz, więc sprawdzenie jej raz, przed wysłaniem, nie wymaga zbiorczego
  zapytania. `IBatchRule<T>` ma sens tam, gdzie odpowiedź zależy od STANU BAZY per element
  (istnienie, duplikat, status), nie od samej wartości komendy.
- **Chain mode** nie ma dziś w Catalogu przykładu z prawdziwą komendą — moduł nie ma jeszcze
  komendy przypisania kategorii do produktu, która dałaby naturalną parę zależnych reguł
  (`CategoryMustExistRule` → `CategoryMustBeActiveRule`). Klasa `ValidationChain<T>` jest
  gotowa i przetestowana logicznie, ale bez żywego konsumenta w tym repo poza samym
  building blockiem.
- **Middleware komend** (FluentValidation, idempotencja) z [`cqrs.md#6`](./cqrs.md#6-czego-jeszcze-nie-ma)
  to osobny, wciąż niezaimplementowany temat — dotyczy pojedynczej komendy na wejściu HTTP,
  nie wsadu.

---

## 5. Zobacz też

- [Operacje masowe](./bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`, częściowe niepowodzenie
- [CQRS — komendy i zapytania](./cqrs.md) — `DomainException`, walidacja w agregacie
- [Architektura backendu](./architecture.md)
