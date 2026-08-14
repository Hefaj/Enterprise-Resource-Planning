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

Konfiguracje jako `IEntityTypeConfiguration<T>` w `<Moduł>.Infrastructure/Persistence/Configurations/`,
wciągane przez `ApplyConfigurationsFromAssembly`.

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

### Właściwości wyliczane

`Product.Available` jest wyliczane ze `Status`, nie zapisywane (`builder.Ignore(p => p.Available)`).
W danych mockowych „available" i „status" były dwoma niezależnie zapisywanymi polami o tym samym
znaczeniu — czyli zaproszeniem do rozjechania się w czasie. Kontrakt HTTP nadal zwraca oba.

### Kwoty

`numeric(18,2)`, nigdy typ zmiennoprzecinkowy — `float` przy sumowaniu pozycji daje groszowe rozjazdy.

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
zmiennej `CATALOG_CONNECTION_STRING`, w jej braku z domyślnych ustawień `podman-compose.yml`.

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
