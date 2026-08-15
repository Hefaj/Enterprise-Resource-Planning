# Persystencja — EF Core i PostgreSQL

**Stan: ✅ działa** (Catalog). Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).

---

## 1. Topologia bazy

Jeden Postgres, **schemat per moduł**: `catalog`, `notification`, `sales`. Każdy moduł ma własny
`DbContext`, własny łańcuch migracji i własną tabelę historii migracji **wewnątrz swojego schematu**.

Domyślnie EF trzyma `__EFMigrationsHistory` w schemacie `public` — przy kilku modułach w jednej bazie
wszystkie biłyby się o jedną tabelę i migracje jednego modułu „widziałyby" migracje innego.
Dlatego `UseErpPostgres` ustawia to jawnie:

```csharp
optionsBuilder.UseErpPostgres(
    connectionString,
    CatalogDbContext.SchemaName,          // "catalog"
    typeof(CatalogDbContext).Assembly.GetName().Name);
```

**Joiny między schematami są zakazane.** Dane obce sprowadza się wyłącznie zdarzeniami
(read-model replica) — patrz [`events-outbox.md`](./events-outbox.md). Technicznie nic nie broni
napisać takiego joina, dlatego granicy pilnuje osobny `DbContext` per moduł: kontekst Catalogu
po prostu nie zna encji Notification.

---

## 2. Co `ErpDbContext` ustala za wszystkich

[`ErpDbContext`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/ErpDbContext.cs)
narzuca trzy rzeczy konwencją, żeby nie dało się ich pominąć w pojedynczej konfiguracji encji:

| Cecha | Realizacja | Dlaczego konwencją, a nie per encja |
|---|---|---|
| Klucz główny `Uuid` | Automatycznie dla każdego `AggregateRoot` | — |
| **`xmin` jako token współbieżności** | `IsConcurrencyToken()` na systemowej kolumnie Postgresa | Pominięcie w jednej konfiguracji jest niewidoczne do chwili, w której dwie równoległe zmiany po cichu się nadpiszą. Nie tworzy dodatkowej kolumny w tabeli. |
| `snake_case` | `UseSnakeCaseNamingConvention()` | Konwencja Postgresa bez ręcznego `HasColumnName` przy każdej właściwości |

Dodatkowo `UseErpPostgres` włącza **split query**:

```csharp
npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
```

Bez tego zapytanie pobierające kilka kolekcji naraz daje iloczyn kartezjański — produkt ze 100
gwarancjami, 5 multimediami i 3 kategoriami to **1500 wierszy na jeden produkt**. To nie jest
teoretyczne: EF wypisywał ostrzeżenie `MultipleCollectionIncludeWarning` przy każdym `getProduct`.

---

## 3. Identyfikatory — UUID v7

Nowe identyfikatory generuje `Entity.NewUuid()` → `Guid.CreateVersion7()`. Sekwencyjny po czasie,
więc wstawki dopisują się na końcu indeksu B-tree zamiast rozrzucać go losowo jak v4.

`Guid` (a nie `int`) jest wymuszony kontraktem: orkiestratory na frontendzie adresują agregaty po
`uuid` (`IdentityMapStore`, `SearchResponse.Uuids`, sygnatury SignalR).

**Wyjątek — seed.** `Guid.CreateVersion7()` opiera się na czasie i entropii systemowej, więc
nie nadaje się do danych powtarzalnych. Seeder generuje identyfikatory z `Random` o stałym ziarnie
(`CatalogSeedOptions.RandomSeed`) — patrz sekcja 6.

---

## 4. Mapowanie agregatów

Konfiguracje jako `IEntityTypeConfiguration<T>` leżą w `<Moduł>.Infrastructure/Persistence/Configurations/`
i są stamtąd automatycznie wciągane przez `ApplyConfigurationsFromAssembly`.

Aby uniknąć tworzenia gigantycznych plików (jak dawniej `CatalogConfigurations.cs`), każda konfiguracja trafia do osobnego pliku, a te grupujemy w podfolderach odpowiadających poszczególnym agregatom (np. `Configurations/Product/ProductConfiguration.cs`, `Configurations/Category/CategoryConfiguration.cs` itp.).

### Kolekcje wewnątrz agregatu

Byty, które nie mają sensu bez korzenia (przypisania kategorii, powiązania z multimediami, okresy
gwarancji), są mapowane jako **owned**:

```csharp
builder.OwnsMany<ProductCategoryLink>("_categories", link =>
{
    link.ToTable("product_category");
    link.WithOwner().HasForeignKey(l => l.ProductUuid);
    link.HasKey(l => new { l.ProductUuid, l.CategoryUuid });
    link.HasIndex(l => l.CategoryUuid);
});
```

Trzy pułapki, na które trzeba uważać:

1. **Nazwa nawigacji to prywatne pole** (`"_categories"`), nie właściwość publiczna. Właściwości
   publiczne (`CategoryUuids`, `Warranties`) są tylko odczytową fasadą i **muszą** być zignorowane:

   ```csharp
   builder.Ignore(p => p.CategoryUuids);
   builder.Ignore(p => p.Warranties);
   ```

   Bez tego EF widzi dwie ścieżki do tych samych danych i albo mapuje je jako osobne relacje,
   albo w ogóle odmawia zbudowania modelu.

2. **Typu owned nie da się odpytać przez `Set<T>()`** — EF rzuca wtedy
   `Cannot create a DbSet for 'X' because it is configured as an owned entity type`.
   Filtrowanie idzie przez nawigację właściciela:

   ```csharp
   query.Where(p => EF.Property<List<ProductCategoryLink>>(p, "_categories")
       .Any(l => categoryUuids.Contains(l.CategoryUuid)));
   ```

3. **Zagnieżdżone typy owned (owned w owned) nie są obsługiwane** przez
   `AggregateChangeScanner` — patrz [`events-outbox.md`](./events-outbox.md#3-skaner-changetrackera).

### Klucz dziecka agregatu nadaje BAZA, nie konstruktor

Kolekcje wewnętrzne `Product` (`product_category`, `product_multimedia`, `product_warranty`)
mają klucz techniczny `uuid` z `ValueGeneratedOnAdd()` i `DEFAULT gen_random_uuid()`. Konstruktor
**nie** ustawia tej wartości — i to jest cała istota tego zapisu.

Kiedy EF napotka podczas wykrywania zmian nieśledzoną encję w kolekcji śledzonego rodzica,
rozstrzyga „nowa czy istniejąca” po tym, czy jej klucz ma wartość różną od domyślnej.
**Klucz ustawiony ⇒ EF zakłada wiersz, który już jest w bazie, i planuje UPDATE zamiast
INSERT-a.** Przy podmianie kompletu kategorii produktu kończyło się to poleceniem:

```sql
UPDATE product_category SET category_uuid = @p14 WHERE uuid = @p16;  -- 0 wierszy
```

gdzie `@p16` to świeżo wygenerowany identyfikator, którego w tabeli nie ma. Objaw zależał od
kształtu klucza: przy kluczu złożonym z danych (`product_uuid` + `category_uuid`) EF nie potrafił
zaktualizować kolumn klucza głównego i **po cichu nie robił nic** — usunięcia się zapisywały,
dodania znikały, a `SaveChanges` zgłaszał sukces. Przy kluczu technicznym ten sam mechanizm
daje przynajmniej głośny `concurrency_conflict`.

Trzy wnioski warte zapamiętania przy dodawaniu kolejnej kolekcji do agregatu:

1. **Nie nadawaj klucza dziecka w konstruktorze.** Zostaw domyślny i pozwól go wygenerować bazie.
   Cena: te identyfikatory to UUID v4, bez lokalności czasowej w indeksie — dla wąskich tabel
   powiązań akceptowalna.
2. **Mapuj przez `HasMany`/`WithOne`, nie `OwnsMany`** — i pamiętaj, że wtedy EF **nie dołącza
   kolekcji automatycznie**. Repozytorium musi zrobić `Include`. Pominięcie go jest groźniejsze,
   niż wygląda: metody domenowe podmieniające KOMPLET powiązań zobaczyłyby pustą kolekcję
   i dopisały nowe obok starych, zamiast je zastąpić.
3. **Regułę „jedno powiązanie na parę” wyraź unikalnym indeksem**, nie kluczem głównym.

Granica agregatu nie zmienia się przez to ani trochę: dzieci nadal nie mają własnego `DbSet`,
nadal wchodzi się do nich wyłącznie przez `Product`, a `OnDelete(Cascade)` utrzymuje regułę
„dziecko nie istnieje bez produktu”.

Uwaga na `AggregateChangeScanner`: przypisuje zmienione dziecko do agregatu przez
`FindOwnership()`, które dla encji nie-owned zwraca `null`. Ma z tego powodu drugą ścieżkę —
po jednoznacznym kluczu obcym wskazującym korzeń agregatu. Bez niej zmiana samych kategorii
przestałaby rozgłaszać `AggregateChanged` po SignalR.

### Właściwości wyliczane

`Product.Available` jest wyliczane ze `Status`, nie zapisywane (`builder.Ignore(p => p.Available)`).
W danych mockowych „available" i „status" były dwoma niezależnie zapisywanymi polami o tym samym
znaczeniu — czyli zaproszeniem do rozjechania się w czasie. Kontrakt HTTP nadal zwraca oba.

### Kwoty

`numeric(18,2)`, nigdy typ zmiennoprzecinkowy — `float` przy sumowaniu pozycji daje groszowe rozjazdy.

### Unikalność po ZBIORZE wartości — kolumna-sygnatura

Reguła „produkt nie może mieć tego samego modelu i tego samego kompletu kategorii, co inny"
jest unikalnością, ale nie da się jej wyrazić indeksem złożonym: kategorie są **zbiorem** wierszy
w `product_category`, a nie kolumną w `product`. Indeks po `(model_uuid, category_uuid)`
odpowiadałby na inne pytanie („czy dzielą choć jedną kategorię"), a walidacja wyłącznie
aplikacyjna nie jest gwarancją — dwie równoległe komendy przeszłyby ją obie.

Rozwiązanie: **trwała kolumna-sygnatura** liczona przez agregat i unikalny indeks po niej.

```csharp
builder.Property(p => p.DuplicateKey).HasMaxLength(64);
builder.HasIndex(p => p.DuplicateKey)
    .IsUnique()
    .HasFilter("duplicate_key IS NOT NULL");
```

Cztery decyzje, które się na to składają:

1. **Skrót, nie surowy string.** `Product.ComputeDuplicateKey` liczy SHA-256 z modelu
   i posortowanych, odduplikowanych identyfikatorów kategorii. Produkt w kilkudziesięciu
   kategoriach dałby ponad kilobajt, a wpis w indeksie btree Postgresa nie mieści się powyżej
   ~2,7 kB. SHA-256, a nie `string.GetHashCode` — ten drugi losuje ziarno per proces, więc klucz
   zapisany dziś nie zgadzałby się z policzonym po restarcie.
2. **Sortowanie i deduplikacja są częścią definicji** — „ten sam zbiór kategorii" ma znaczyć
   to samo niezależnie od kolejności w komendzie.
3. **Jedna funkcja, trzech konsumentów.** Klucz liczy agregat przy zapisie, reguła wsadowa przy
   pre-checku i backfill przy migracji — wszyscy wołają tę samą metodę. Druga implementacja tej
   samej definicji (np. w SQL-u migracji) oznaczałaby pre-check pytający bazę o wartości,
   których zapis nigdy nie wygeneruje.
4. **`NULL` = „nie uczestniczy w regule"** (produkt bez modelu). Postgres i tak traktuje NULL-e
   jako różne, więc nie trzeba wartości-wartownika; filtr `IS NOT NULL` dodatkowo trzyma te
   wiersze poza indeksem.

**Migracja dodaje kolumnę pustą**, a nie wyliczoną — dzięki temu utworzenie unikalnego indeksu
nie może paść na danych zastanych i wdrożenie nigdy nie blokuje się na istniejących duplikatach.
Ceną jest osobny krok backfillu (`CatalogDatabaseInitializer`), który liczy klucze w C#, kolizje
**loguje zamiast rzucać** i zostawia kolidujące wiersze z `NULL` — istniejący duplikat to
informacja do rozstrzygnięcia biznesowego, a nie powód, by serwis się nie podniósł.

Naruszenie takiego indeksu w czasie działania trzeba przetłumaczyć na kod domenowy, inaczej
raport z operacji masowej pokaże `persistence_error` — patrz
[`bulk-commands.md`](./bulk-commands.md#naruszenie-unikalności-to-reguła-biznesowa-nie-awaria).

---

## 5. Drzewo kategorii — tabela domknięcia

Hierarchia jest w `category.parent_uuid`, ale **żadne zapytanie o strukturę nie chodzi po niej rekurencyjnie**.
Obok żyje `category_closure(ancestor_uuid, descendant_uuid, depth)` — para (przodek, potomek)
z odległością, plus wiersz każdego węzła do samego siebie na `depth = 0`.

Bez tego indeksu wersja mockowa liczyła `descendantCount` rekurencyjnie w pamięci i **jedno
stronicowane zapytanie o kategorie kosztowało 9,2 sekundy**. Po przejściu na domknięcie: 17–60 ms.

Do czego służy:

| Pytanie | Zapytanie |
|---|---|
| `childCount` | `COUNT(*)` po `category.parent_uuid` |
| `descendantCount` | `COUNT(*)` z domknięcia po `ancestor_uuid`, `depth > 0` |
| Przodkowie węzła (ścieżka do korzenia) | domknięcie po `descendant_uuid`, `depth > 0` |
| Rozwinięcie zaznaczenia `TreeSelectionRequest` | patrz niżej |
| Wykrycie cyklu przy przenoszeniu węzła | `WouldCreateCycleAsync` — jedno zapytanie po indeksie |

Utrzymuje ją [`CategoryClosureMaintainer`](../../backend/modules/Catalog/Catalog.Infrastructure/Persistence/CategoryClosureMaintainer.cs)
surowym SQL-em (rekurencyjne CTE dla pełnej przebudowy, `INSERT … SELECT` dla nowego liścia).
Surowy SQL jest tu celowy: przebudowa domknięcia dla drzewa o setkach tysięcy węzłów przez
ChangeTracker oznaczałaby materializację milionów wierszy w pamięci procesu.

To **indeks pochodny**, w całości wyliczalny z `parent_uuid` — zawsze da się go odtworzyć
przez `RebuildAllAsync()`.

### Semantyka zaznaczenia drzewa

`TreeSelectionRequest` niesie deskryptor (`Ids`, `SubtreeRoots`, `Excluded`), nie płaską listę
identyfikatorów — zaznaczenie korzenia nie może wymagać wypisania stu tysięcy potomków w request body.

Reguły rozstrzygania (port frontendowego `isNodeIncluded`, `ProductQueries.ResolveSelectedCategoryUuidsAsync`):

1. Węzeł w `Ids` → **zawsze włączony**, niezależnie od reszty.
2. Dla samego węzła: `Excluded` rozstrzyga **przed** `SubtreeRoots`. To realizuje wzorzec
   „poddrzewo X bez samego X" (`SubtreeRoots: [X], Excluded: [X]`).
3. Dla przodków: wygrywa **bliższy** znacznik, a przy równej odległości — `SubtreeRoots`.
   Dzięki temu potomek węzła z wzorca „X bez samego X" trafia na X jako korzeń i zostaje włączony,
   mimo że ten sam X jest dla siebie wykluczeniem.

Implementacja porównuje odległości do najbliższego korzenia i najbliższego wykluczenia
(`MinDepthByDescendantAsync`). Naiwne „usuń całe poddrzewo wykluczenia" jest **błędne** —
łamie regułę 3 i sprowadza wzorzec „X bez samego X" do pustego zbioru.

> **Ograniczenie skali.** Rozwiązanie zaznaczenia materializuje identyfikatory poddrzewa w pamięci.
> Przy obecnych rozmiarach to nieistotne, ale filtrowanie po zaznaczeniu gałęzi syntetycznej
> w profilu `Stress` wymagałoby przeniesienia tego do jednego zapytania z `EXISTS` po domknięciu.

---

## 6. Dane startowe

[`CatalogSeeder`](../../backend/modules/Catalog/Catalog.Infrastructure/Seed/CatalogSeeder.cs)
zastąpił `CatalogMockData`. Zachowuje te same wolumeny i nazwy, więc frontend widzi dane, do których
był przyzwyczajony.

- **Idempotentny** — jeśli tabela kategorii nie jest pusta, nie robi nic. Może więc wisieć
  w starcie aplikacji bez ryzyka duplikacji.
- **Deterministyczny** — stałe ziarno generatora. Poprzednia wersja losowała `Guid.NewGuid()`
  przy każdym starcie procesu; przy realnej bazie oznaczałoby to, że żaden zapisany link
  ani test oparty na konkretnym rekordzie nie przeżywa restartu.
- **Kategorie wstawiane binarnym `COPY`** Npgsql, nie przez EF — przy 180 tys. wierszy
  ChangeTracker i tyleż poleceń `INSERT` byłyby o rzędy wielkości wolniejsze. Reszta
  (1500 produktów, 15 modeli, 150 gwarancji) idzie zwykłym EF, bo tam ta złożoność się nie zwraca.

### Profile drzewa

Gałąź syntetyczna służy testowaniu wirtualizacji i stronicowania `erp-tree`. Rozmiar steruje
`Seed:TreeProfile`:

| Profil | Węzły | Zastosowanie |
|---|---|---|
| `None` | ~90 | Tylko ręcznie nazwane kategorie |
| `Small` *(domyślny)* | ~180 tys. (50 × 600 × 5) | Dev. Środkowy poziom (600 dzieci) przekracza `pageSize` = 50, więc wymusza scenariusz „load more" — a to on jest przedmiotem testu, nie liczba liści |
| `Stress` | ~9,03 mln (50 × 600 × 300) | Testy wydajnościowe. Domknięcie urasta do dziesiątek milionów wierszy, seed liczy się w minutach |

Profil `Stress` odtwarza wolumen, który generował poprzedni mock in-memory — było to 9 030 158
kategorii, najprawdopodobniej niezamierzony efekt mnożenia trzech poziomów.

Konfiguracja (`appsettings.Development.json`):

```json
"Seed": { "Enabled": true, "TreeProfile": "Small", "ProductCount": 1500 }
```

---

## 7. Migracje

```bash
export PATH="$PATH:$HOME/.dotnet/tools"
```

Nowa migracja:

```bash
dotnet ef migrations add NazwaMigracji --project backend/modules/Catalog/Catalog.Infrastructure --startup-project backend/modules/Catalog/Catalog.Infrastructure --output-dir Persistence/Migrations
```

Zastosowanie:

```bash
dotnet ef database update --project backend/modules/Catalog/Catalog.Infrastructure --startup-project backend/modules/Catalog/Catalog.Infrastructure
```

`--startup-project` wskazuje na `Infrastructure`, a nie na `Api`, dzięki
[`CatalogDbContextFactory`](../../backend/modules/Catalog/Catalog.Infrastructure/Persistence/CatalogDbContextFactory.cs)
(`IDesignTimeDbContextFactory`). Bez niej `dotnet ef` musiałby wystartować cały host — a ten wymaga
działającego RabbitMQ. Fabryka pozwala generować migracje offline. Łańcuch połączenia bierze ze
zmiennej `CATALOG_CONNECTION_STRING`, w jej braku z domyślnych ustawień `docker-compose.yml`.

Migracje są **kodem generowanym** i tak są oznaczone w `backend/.editorconfig`
(`generated_code = true`) — inaczej analizatory wymuszałyby ręczne poprawianie pliku po każdej
regeneracji albo rozluźnienie reguł w całym projekcie.

W `Development` migracje stosuje przy starcie `CatalogDatabaseInitializer`, sterowany flagą
`Database:MigrateOnStartup`. **To jest wygoda deweloperska, nie wzorzec produkcyjny**: przy wielu
instancjach serwisu każda migrowałaby równolegle, a nieudana migracja przewracałaby aplikację
zamiast zatrzymać wdrożenie.

---

## 8. Zobacz też

- [Architektura backendu](./architecture.md)
- [CQRS — komendy i zapytania](./cqrs.md)
- [Zdarzenia domenowe i outbox](./events-outbox.md)
