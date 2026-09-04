---
id: backend.batch-validation
title: Walidacja wsadowa (batch validation)
summary: Walidacja wsadowa przez IBatchRule i ValidationChain przed utworzeniem zadania.
kind: guide
scope: backend
audience:
  - backend
  - agent
triggers:
  - walidacja wsadowa
  - IBatchRule lub ValidationChain
related: []
---

# Walidacja wsadowa (batch validation)

**Stan: ✅ działa.** Mechanizm wspólny (`Erp.BuildingBlocks.Validation`). Podpięty w Catalog
(`ProductMustExistRule` dla `product/batch-set-price`/`batch-set-name`, `ProductDuplicateRule`
dla `product/batch-set-classification`) i w Identity (`RoleGraphCycleRule`, `RoleCodeUniqueRule`,
reguły istnienia — patrz [`identity-authz.md` §7](../../architecture/security.md#7-mapa-wdrożenia--gdzie-co-leży)).
Cel odrzucony przez pre-check dostaje `job_item.status = Failed` i `error_code` **przy tworzeniu
zadania**, zanim `BulkCommandRunner` w ogóle je zobaczy.

---

## 1. Po co to istnieje

[`cqrs.md`](cqrs.md#3-komendy) i [`bulk-commands.md`](bulk-commands.md) opisują już jedną
warstwę walidacji: **metoda agregatu waliduje przed zmianą stanu**, a `DomainException` jednego
elementu nie przerywa chunka operacji masowej. To działa dobrze dla reguł, które dotyczą
WYŁĄCZNIE jednego agregatu naraz (cena nieujemna, nazwa niepusta).

Nie działa dobrze dla reguł, które z natury są **zbiorcze** — „czy ta klasyfikacja nie jest
duplikatem w bazie", „czy wszystkie te 5000 kategorii istnieje i jest aktywnych". Walidacja per
agregat oznaczałaby jedno zapytanie do bazy na element; przy operacji masowej na kilku tysiącach
celów to kilka tysięcy zapytań, z których każde i tak kończy się tym samym wynikiem dla całej
klasy elementów. Batch validation istnieje po to, żeby taką regułę dało się sprawdzić **jednym
zapytaniem na cały wsad**, a wynik rozdzielić z powrotem po elementach.

Drugi powód: uruchomienie tego PRZED utworzeniem zadania (`job`/`job_item`) oznacza, że
oczywiście błędne cele nigdy nie trafiają do `BulkCommandRunner` — użytkownik dostaje
informację o odrzuceniu razem z `jobUuid`, zamiast czekać na `IdlePollingInterval` rundy
runnera, żeby dowiedzieć się tego samego.

### 1.1. Czym to NIE jest: pre-check ≠ gwarancja

To rozróżnienie jest najważniejszą rzeczą w tym dokumencie.

Pre-check biegnie przy **tworzeniu zadania** (żądanie HTTP). Wykonanie następuje **później** —
asynchronicznie, chunkami, w `BulkCommandRunner`, nawet kilka minut potem. W tym oknie stan bazy
może się dowolnie zmienić: równoległe żądanie zajmie sygnaturę, którą pre-check widział jako
wolną. Żadna walidacja aplikacyjna tego nie zamyka — dwie równoległe komendy przeszłyby ją obie.

Dlatego każda reguła oparta na **unikalności** musi mieć dwie warstwy:

| Warstwa | Rola | Gdzie |
|---|---|---|
| Unikalny indeks w bazie | **Gwarancja.** Jedyna rzecz odporna na współbieżność. | migracja EF, np. `ix_product_duplicate_key` |
| `IBatchRule<T>` | **Zapowiedź.** Szybka, tania informacja dla użytkownika. | `Application` modułu |
| `IPersistenceExceptionTranslator` | **Spójność raportu.** Naruszenie indeksu dostaje ten sam kod, co odrzucenie z pre-checku. | `Infrastructure` modułu |

Bez trzeciego elementu duplikat, który prześlizgnął się przez pre-check, trafiłby do raportu jako
`persistence_error` i był ponawiany aż do wyczerpania `MaxAttempts` — mimo że jest trwały.
Patrz [`bulk-commands.md`](bulk-commands.md).

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
reszty strony odczytu CQRS (patrz [`cqrs.md`](cqrs.md#4-zapytania)).

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
    IReadOnlyList<BatchTarget<TCommand>> targets, CancellationToken ct)
    => Task.FromResult(new ValidationTracker());
```

`HandleAsync` woła go PO rozwiązaniu trzech trybów kontraktu (`Commands` / szablon+uuidy /
szablon+filtr) na listę `JobTarget`, a PRZED `IJobStore.CreateAsync`. Tracker zamienia się na
`IReadOnlyDictionary<Guid, (string ErrorCode, string ErrorMessage)>` (pierwszy błąd na element
wygrywa) i leci do `Job.Create` jako `preValidatedFailures`.

### Dlaczego cel niesie komendę, a nie sam identyfikator

`BatchTarget<TCommand>` to para `(AggregateUuid, Command)`. Reguła „czy agregat istnieje"
zadowala się identyfikatorem, ale reguła duplikatu potrzebuje **wartości docelowych** — jaki
model i jakie kategorie zostaną ustawione. Pytanie „czy ten produkt jest teraz duplikatem" jest
bezużyteczne; interesuje nas, czy **stanie się** nim po komendzie.

Payload odtwarza `BatchCommandPayload.Materialize<TCommand>` — **ten sam** helper, którego używa
`BulkCommandExecutor` przy faktycznym wykonaniu. To nie jest kosmetyka: gdyby pre-check
i wykonanie deserializowały komendę własnym kodem, rozjechałyby się przy pierwszej zmianie
kontraktu, a walidacja zaczęłaby sprawdzać coś innego, niż faktycznie się wykona.

Lista **nie jest** odduplikowana po agregacie — tryb jawnej listy komend dopuszcza kilka różnych
komend dla tego samego agregatu i reguła musi je zobaczyć wszystkie. Deduplikacja, jeśli reguła
jej potrzebuje (jak `ProductMustExistRule`), należy do wołającego.

`Job.Create` od razu oznacza pasujące elementy jako `JobItemStatus.Failed`
(`maxAttempts: 1` — to nie jest błąd przejściowy do ponowienia, tylko ostateczne odrzucenie
sprzed startu zadania) i liczy `job.FailedCount` po fakcie utworzenia elementów.

**`BulkCommandRunner` nie wymagał ŻADNEJ zmiany.** Element bez statusu `Pending` po prostu nie
pojawia się w jego zapytaniu o kolejny chunk (`WHERE Status = Pending`). Zadanie, w którym
WSZYSTKIE elementy odpadły na pre-checku, ma `RemainingCount == 0` od razu po utworzeniu —
runner zamyka je (`FinishJobAsync` → `job.Complete()`) przy najbliższym przebiegu pętli, tak
samo jak zadanie, które właśnie skończyło ostatni chunk.

### Gdzie żyje kompozycja reguł

**Nie w endpoincie.** „Które reguły obowiązują przy masowej zmianie X" to decyzja przypadku
użycia, nie transportu — zostawiona w konstruktorze endpointu znika, gdy tę samą komendę zleci
konsumer zdarzeń albo harmonogram, a przy czwartej regule zamienia endpoint w miejsce
orkiestracji biznesowej. Decyzja mieszka w `ProductBatchValidator`
(`Catalog.Application/Products/`), a endpoint tylko deleguje:

```csharp
protected override Task<ValidationTracker> ValidateTargetsAsync(
    IReadOnlyList<BatchTarget<ProductSetClassificationCommand>> targets, CancellationToken ct)
    => _validator.ValidateSetClassificationAsync(
        [.. targets.Select(t => new ProductClassificationTarget(
            t.AggregateUuid, t.Command.ModelUuid, t.Command.CategoryUuids))],
        ct);
```

Skutek uboczny, ale nie drugorzędny: pre-check da się przetestować bez podnoszenia endpointu
FastEndpoints przez `Factory.Create<>` — patrz `backend/tests/Catalog.Tests`.

Rejestracja w DI: **żadna ręczna**. `AddErpModule` (wołane raz w `Program.cs`) wyłapuje reguły
po implementowanym `IBatchRule<T>`, a kompozytory po znaczniku `IBatchValidator` — obie grupy
rejestruje jako `Scoped` pod ich własnym typem. Nowa reguła nie dopisuje linijki nigdzie:
wystarczy, że implementuje interfejs i leży w skanowanym zestawie modułu.

Kompozytor **musi** dziedziczyć `IBatchValidator` — inaczej wypadnie z kontenera i wyjdzie to
dopiero przy pierwszym żądaniu do endpointu masowego. Sufiks w nazwie nic tu nie znaczy.

### Reguła duplikatu — kolizje wewnątrz wsadu

`ProductDuplicateRule` pokazuje pułapkę, której reguła „per element względem bazy" nie łapie:
wsad nadający **tę samą** klasyfikację 500 produktom przejdzie w całości, bo żaden z nich nie
koliduje z tym, co jest w bazie — kolidują ze sobą. Reguła widzi cały wsad, więc rozstrzyga to
sama: prowadzi słownik `claimed`, pierwszy element zgłaszający sygnaturę ją zajmuje, każdy
kolejny dostaje `product_duplicate`.

Sygnaturę liczy `Product.ComputeDuplicateKey` — **ta sama** funkcja, którą agregat policzy klucz
przy zapisie. Gdyby reguła liczyła go po swojemu, odpytywałaby bazę o wartości, których zapis
nigdy nie wygeneruje.

---

## 4. Czego (świadomie) tu nie ma

- **Walidacja payloadu komendy w oderwaniu od bazy** (np. „cena musi być dodatnia") nie korzysta
  z tego mechanizmu — w trybie szablonu ta sama wartość dotyczy WSZYSTKICH celów naraz, więc
  sprawdzenie jej raz nie wymaga zbiorczego zapytania; poprawność wartości należy do agregatu.
  `IBatchRule<T>` ma sens tam, gdzie odpowiedź zależy od STANU BAZY per element (istnienie,
  duplikat, status) — przy czym reguła może przy tym potrzebować payloadu, bo pyta o stan
  PO zmianie (`ProductDuplicateRule`), nie przed.
- **Chain mode** nie ma dziś w repo żywego konsumenta — brakuje naturalnej pary zależnych
  reguł (`CategoryMustExistRule` → `CategoryMustBeActiveRule`). `ProductBatchValidator` (tak samo
  `RoleBatchValidator`/`UserBatchValidator` w Identity) woła swoje reguły płasko, bo są niezależne i chcemy zebrać wszystkie naruszenia elementu naraz.
  Klasa `ValidationChain<T>` jest gotowa, ale bez konsumenta poza building blockiem.
- **Walidacja wejścia z pipeline'u komend** (`IValidator<TCommand>`, [`cqrs.md` §6](cqrs.md#6-pipeline-komend))
  to osobna warstwa: sprawdza kształt POJEDYNCZEJ komendy bez sięgania do bazy i biegnie przy
  każdym jej wykonaniu — również dla elementu zadania masowego. Pre-check wsadowy odpowiada na
  pytania, których nie da się rozstrzygnąć bez zbiorczego zapytania, i biegnie RAZ, przed
  utworzeniem zadania. Odrzucenie przez walidator elementu wsadu zachowuje się jak każde inne
  naruszenie reguły (`CommandValidationException` dziedziczy po `DomainException`).
- **Mapowanie `DomainException` → `ProblemDetails`** na ścieżce HTTP zapewnia
  `ErpProblemDetailsHandler` — te same kody błędów co w `job_item.error_code`.

---

## 5. Zobacz też

- [Operacje masowe](bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`, częściowe niepowodzenie
- [CQRS — komendy i zapytania](cqrs.md) — `DomainException`, walidacja w agregacie
- [Architektura backendu](../../architecture/backend.md)
