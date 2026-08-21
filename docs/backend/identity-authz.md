# Tożsamość i uprawnienia — Keycloak (AuthN) + moduł Identity (AuthZ)

Stan: **Fazy 1-3 ✅ wdrożone i zweryfikowane end-to-end** (realny Keycloak, realne logowanie
w przeglądarce, mikroserwis Identity z domeną ról/uprawnień, hierarchia z wykrywaniem cykli,
efektywne uprawnienia i ścieżka dziedziczenia, JIT provisioning, egzekwowanie uprawnień
w Catalog i Sales z potwierdzonym SLA odwołania ≤60s). **Faza 4 ✅ szkielet modułu frontendowego
`identity`** (routing, menu, federacja, tłumaczenia — zweryfikowane w przeglądarce), z pierwszą
właściwą stroną (historia nadań, dodana w Fazie 6) obok placeholdera dashboardu — `users`/`roles`
jako pełne ekrany zarządzania nadal odłożone jako osobny przyrost.
**Faza 5 ✅ bramkowanie UI, zweryfikowane end-to-end** (`PermissionStore`, `erpPermissionGuard`,
`*erpHasPermission`, filtr menu, strona `/forbidden`, toast na 403 — potwierdzone w
przeglądarce z realnym Keycloak + Catalog + Notification + Identity, kontem `administrator`
i nowo utworzonym kontem bez żadnej roli). **Faza 6 ✅ audyt i domknięcie** (`grant_audit`
append-only, czyszczenie wygasłych nadań, wymuszone wylogowanie przez Keycloak Admin API,
bramkowanie własnych endpointów Identity, przebudowa menu na żywą zmianę uprawnień —
zweryfikowane buildem/testami całego rozwiązania i w przeglądarce; szczegóły i znane
ograniczenia w §7 niżej).
Legenda znaczników jak w [`architecture.md` §1](./architecture.md#1-stan-wdrożenia).
Szczegóły zaimplementowanych faz → §7 niżej i sekcje 2-6 (opisują już wdrożony stan, nie
tylko projekt).

Dokument opisuje docelowy kształt uwierzytelniania i autoryzacji oraz **plan wdrożenia w 6 fazach**.
Każda faza jest samodzielnie weryfikowalna i zostawia system w stanie działającym.

---

## 1. Decyzja architektoniczna

**Rozdzielamy uwierzytelnianie od autoryzacji i dajemy je dwóm różnym systemom.**

| Pytanie | Kto odpowiada | Dlaczego tam |
|---|---|---|
| *Kim jesteś?* (AuthN) | **Keycloak** | Hasła, hashowanie, MFA, reset, blokady, sesje, refresh tokeny, SSO, federacja LDAP/AD. To rozwiązany problem — pisanie tego samemu w ERP to czysty koszt i ryzyko. |
| *Co możesz?* (AuthZ) | **własny mikroserwis `Identity`** | Uprawnienia są **danymi biznesowymi ERP**: role odwzorowują stanowiska, nadania podlegają audytowi, administrator ustawia je w UI systemu, a nie w panelu admina IdP. |

### Dlaczego NIE Keycloak Authorization Services

Keycloak potrafi trzymać drobnoziarniste polityki (UMA, resources/scopes/policies). Odrzucone świadomie:

- panel administracyjny Keycloaka nie jest interfejsem dla kierownika działu — a to on ma nadawać role;
- polityki żyją poza repo i poza migracjami, więc wypadają z przeglądów kodu i z odtwarzalności środowisk;
- każdy request do zasobu oznacza odpytanie Keycloaka (albo tokeny RPT z własnym cyklem życia) — dokładany hop na ścieżce gorącej;
- katalog uprawnień ERP musi być wersjonowany razem z kodem, który go sprawdza (patrz §3). W Keycloaku byłby konfiguracją runtime.

Keycloak zostaje **czystym IdP**: wydaje token, nie wie nic o produktach ani magazynach.

### Dlaczego NIE OpenFGA / Zanzibar (na razie)

ReBAC ma sens, gdy dominującym pytaniem jest „czy user X ma dostęp do **obiektu** Y" (dostępy per dokument, per kontrahent).
Dziś dominującym pytaniem jest „czy user X może wykonać **akcję** A" — na to RBAC z hierarchią ról jest właściwą i prostszą odpowiedzią.
Granica przejścia jest opisana w §9 (zakres danych).

### Co zostaje z pierwotnego pomysłu

Model z pytania — *user ma role + pojedyncze uprawnienia; rola ma uprawnienia i może zawierać role* — to **hierarchiczne RBAC (NIST RBAC1)**, standard branżowy. Zostaje bez zmian. Zmieniają się cztery rzeczy:

1. konta i hasła przenoszą się do Keycloaka, moduł `Identity` trzyma tylko **projekcję** użytkownika (`sub` + nazwa + status);
2. katalog uprawnień jest **definiowany w kodzie**, nie CRUD-owany w UI (§3);
3. wyłącznie **allow**, żadnych `deny` (§2);
4. uprawnienia bezpośrednie użytkownika zostają, ale jako **wyjątek z powodem i audytem**, nie jako równoprawna ścieżka.

---

## 2. Model domenowy modułu `Identity`

Schemat `identity`, osobny `DbContext`, osobny łańcuch migracji — jak każdy moduł.

```
user_account          uuid (= Keycloak `sub`), email, display_name, is_active, synced_at
role                  uuid, code, name, description, is_system, created_at/by
role_permission       role_uuid, permission_code                      (PK złożony)
role_member           container_uuid, member_uuid                     (PK złożony — krawędź DAG)
user_role             user_uuid, role_uuid, granted_at, granted_by, expires_at?
user_permission       user_uuid, permission_code, granted_at, granted_by, reason
permission_catalog    code, module, resource, action, description_key, is_obsolete
grant_audit           append-only: kto, komu, co, kiedy, akcja (grant/revoke), źródło
```

### Kierunek dziedziczenia — jedyne miejsce, gdzie łatwo się pomylić

`role_member(container_uuid, member_uuid)` znaczy: **rola-kontener zawiera rolę-składową i przejmuje jej uprawnienia.**
Użytkownik z rolą „Kierownik magazynu" (kontener) dostaje uprawnienia „Magazyniera" (składowa), nie odwrotnie.
Nazwy kolumn są celowo `container`/`member`, a nie `parent`/`child` — para parent/child przy odczycie kodu regularnie prowadzi do odwrócenia semantyki.

### To jest DAG, nie drzewo

Rola może być składową wielu kontenerów i to jest pożądane (rola „Odczyt cennika" wchodzi do pięciu stanowisk).
Konsekwencje, które muszą być w kodzie:

- **walidacja cyklu przy każdym dodaniu krawędzi** — metoda agregatu `Role.AddMember()` odrzuca, jeśli kandydat jest już przodkiem (rekursywne CTE w handlerze przed wywołaniem metody, wynik podawany do agregatu; agregat nie sięga do bazy);
- `UNION` (nie `UNION ALL`) w rekursywnym CTE — deduplikacja domyka rekurencję nawet gdyby cykl jakimś cudem powstał;
- **bez tabeli domknięcia w v1.** Inaczej niż kategorie produktów ([`CategoryClosureMaintainer`](../../backend/modules/Catalog/Catalog.Infrastructure/Persistence/CategoryClosureMaintainer.cs)), ról są dziesiątki, a nie setki tysięcy, i nie są czytane w pętli renderowania drzewa. Rekursywne CTE przy wyliczaniu efektywnych uprawnień wystarcza; materializacja to optymalizacja na później, nie element projektu.

### Tylko allow

Suma zbiorów, żadnych `deny`. Uzasadnienie: w DAG-u odbieranie uprawnień wymaga reguł pierwszeństwa, a te są zależne od kolejności obchodzenia grafu — po pół roku nikt nie odpowie, czemu Kowalski nie widzi zamówienia. Jeżeli kiedyś odbieranie będzie konieczne, jedyna dopuszczalna forma to `deny` na bezpośrednim nadaniu użytkownika, z pierwszeństwem opisanym w tym pliku **przed** napisaniem kodu.

### Zapytanie o efektywne uprawnienia

```sql
WITH RECURSIVE effective_roles AS (
    SELECT role_uuid FROM identity.user_role
    WHERE user_uuid = @userId AND (expires_at IS NULL OR expires_at > now())
  UNION
    SELECT rm.member_uuid FROM identity.role_member rm
    JOIN effective_roles er ON rm.container_uuid = er.role_uuid
)
SELECT permission_code FROM identity.role_permission
WHERE role_uuid IN (SELECT role_uuid FROM effective_roles)
UNION
SELECT permission_code FROM identity.user_permission WHERE user_uuid = @userId;
```

Wariant tego samego CTE niosący tablicę ścieżki zasila ekran **„skąd to uprawnienie"** (§7) — bez niego zagnieżdżone role przestają być utrzymywalne po kilku miesiącach.

---

## 3. Katalog uprawnień to kod, nie dane

`Erp.BuildingBlocks.Contracts/Permissions.cs` — jedno źródło prawdy, dokładnie na tych samych prawach co
[`AggregateSignatures`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/AggregateSignatures.cs):

```csharp
public static class Permissions
{
    public static class Catalog
    {
        public const string ProductRead   = "catalog.product.read";
        public const string ProductUpdate = "catalog.product.update";
        public const string ProductBulk   = "catalog.product.bulk";
    }

    /// <summary>Pełny katalog — do seedowania i do walidacji przy starcie.</summary>
    public static IReadOnlyList<PermissionDefinition> All { get; } = [ ... ];
}

public sealed record PermissionDefinition(
    string Code, string Module, string Resource, string Action, string DescriptionKey);
```

- Konwencja kodu: `{moduł}.{zasób}.{akcja}`, lowercase, kropka. Ta sama dyscyplina co przy sygnaturach SignalR.
- `DescriptionKey` to **klucz Transloco**, nie tekst — opis uprawnienia w UI idzie przez tłumaczenia, zgodnie z regułą zero-hardcoded-strings.
- Przy starcie `Identity` **uzgadnia** katalog z bazą: dopisuje nowe kody, a znikające oznacza `is_obsolete = true` — **nigdy nie kasuje**, bo istniejące nadania na nie wskazują. Obsolete pokazuje się w UI z ostrzeżeniem i da się tylko odebrać.
- Strona „Uprawnienia" w UI jest **read-only** — przeglądarką katalogu, nie formularzem. Formularz „dodaj uprawnienie" produkuje wiersze, których żaden `if` w kodzie nie sprawdza.
- Bez wildcardów w runtime. Wygoda „wszystko w module" należy do UI nadawania (zaznacz grupę checkboxów), nie do silnika sprawdzania.

---

## 4. Egzekwowanie — jak uprawnienie dociera do Catalogu i Sales

Ograniczenie z [`architecture.md`](./architecture.md): joiny cross-schema są zakazane, a Catalog nie może odpytywać `identity.*`. Rozwiązanie zgodne z resztą systemu:

```
Keycloak ──JWT(sub, perm_ver)──► Catalog.Api
                                     │
                        IClaimsTransformation
                                     │
                          IPermissionProvider (IMemoryCache)
                                     │ miss
                                     ▼
                        GET Identity /internal/users/{id}/permissions
                                     ▲
        RabbitMQ: UserPermissionsChanged ──► invalidacja cache we WSZYSTKICH serwisach
```

- **Token zostaje mały.** Zamiast wpychać kilkaset kodów w nagłówek `Authorization`, token niesie `sub` + `perm_ver` (licznik wersji uprawnień użytkownika, inkrementowany przy każdej zmianie nadań).
- **`IClaimsTransformation`** dokłada claimy `permissions` do `ClaimsPrincipal` z cache'u. Dzięki temu **wbudowany mechanizm FastEndpoints działa bez żadnej warstwy pośredniej**:

  ```csharp
  public override void Configure()
  {
      Put("/products/{uuid}/name");
      Permissions(Permissions.Catalog.ProductUpdate);
  }
  ```

- **Klucz cache**: `perm:{userId}:{permVer}` — niezgodność wersji z tokenem to automatyczny miss, więc nawet gdyby zdarzenie o unieważnieniu przepadło, odnowienie tokenu naprawia stan.
- **Unieważnienie**: `UserPermissionsChanged` (nowy kontrakt w `Erp.BuildingBlocks.Contracts`) przez outbox/RabbitMQ; konsument w bloku wspólnym, więc każdy serwis dostaje go „za darmo".
- **SLA odwołania uprawnień: ≤ 60 s** (TTL cache) w najgorszym przypadku, praktycznie natychmiast przez zdarzenie. Zapisane, bo bez zapisanej liczby nikt tego nie przetestuje.

> ⚠️ Cache uprawnień to **kolejny stan w pamięci procesu**. Musi trafić na listę w
> [`architecture.md` §7](./architecture.md#7-założenia-jednoinstancyjne) — przy skalowaniu poziomym
> unieważnienie musi dojść do każdej instancji (fanout, nie kolejka robocza).

### Zadania masowe

`BulkCommandRunner` odtwarza `IExecutionContext` zleceniodawcy godzinę po zamknięciu jego połączenia.
**Decyzja: autoryzujemy przy tworzeniu zadania, nie przy każdym chunku.** Zadanie zapisuje kod sprawdzonego uprawnienia w wierszu `job`; odebranie uprawnień w trakcie nie zabija trwającego zadania (zabija je `job/cancel`). Alternatywa — sprawdzanie per chunk — daje zadania kończące się w połowie z niejasnym powodem.

---

## 5. Uwierzytelnianie — Keycloak

`docker-compose.yml` (obok postgres i rabbitmq), realm w Postgresie, **schemat `keycloak`** — spójnie z regułą „schemat per moduł":

```yaml
  keycloak:
    image: quay.io/keycloak/keycloak:26.4      # przypnij konkretny tag, nie `latest`
    container_name: erp-keycloak
    command: ["start-dev", "--import-realm"]
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/erp
      KC_DB_SCHEMA: keycloak
      KC_DB_USERNAME: erp
      KC_DB_PASSWORD: erp
    ports: ["8080:8080"]
    volumes:
      - ./keycloak/realm-erp.json:/opt/keycloak/data/import/realm-erp.json:ro
    depends_on:
      postgres: { condition: service_healthy }
```

- Realm `erp`, klient publiczny `erp-client` (Authorization Code + **PKCE**, bez client secret — SPA nie utrzyma sekretu).
- `realm-erp.json` **wchodzi do repo** (odtwarzalne środowisko dev), ale bez haseł produkcyjnych; `start-dev` jest wyłącznie dev-owe.
- Provisioning użytkownika: **JIT przy pierwszym tokenie** — `Identity` zakłada `user_account` z `sub`/`email`/`name` z tokenu. Wyszukiwanie i zapraszanie nowych osób idzie przez Keycloak Admin REST API (zwykły `HttpClient` z tokenem service-account, bez dodatkowej biblioteki).
- `Identity` publikuje `UserChanged` — inne moduły denormalizują `userId` + nazwę wyświetlaną u siebie zamiast joinować.

### Co to naprawia od razu

- [`ExecutionContextMiddleware`](../../backend/building-blocks/Erp.BuildingBlocks.Api/ExecutionContextMiddleware.cs) przestaje czytać `X-User-Id` z nagłówka i czyta `context.User` — nagłówek **znika**, bo dziś każdy może podać cudze `userId`.
- `SyncHub` bierze tożsamość z `Context.UserIdentifier` zamiast z query stringu — luka opisana w [`realtime-signalr.md:45`](./realtime-signalr.md) zostaje zamknięta. Front podaje token przez `accessTokenFactory`.

---

## 6. Frontend

### `@erp/shared/auth` — przepisanie

Dzisiejszy [`ErpAuthService`](../../frontend/libs/shared/auth/src/lib/erp-auth-service.ts) trzyma zamockowany `role: 'Admin' | 'WarehouseManager' | 'SalesRep'` i token w `localStorage`. Zastępuje go:

- `angular-auth-oidc-client` (Authorization Code + PKCE, silent renew). **Musi być `shared` singleton w `federation.config.mjs`** każdego remota — dwie instancje biblioteki OIDC to dwie sesje i losowe wylogowania;
- token w `sessionStorage`/pamięci, **nie `localStorage`** — obecne zachowanie wydłuża okno wykorzystania tokenu po XSS;
- `PermissionStore` — signal `Set<string>`, ładowany raz w `STARTUP.ts` z `GET /me/permissions`, odświeżany na sygnaturze SignalR `identity.user` dla własnego `userId`;
- `erpPermissionGuard('catalog.product.read')` obok istniejącego `erpAuthGuard`;
- dyrektywa strukturalna `*erpHasPermission` dla przycisków i sekcji;
- `requiredPermission` w pozycjach `remoteMenu` — shell filtruje menu, nie każdy moduł osobno.

**Front tylko chowa UI.** Źródłem prawdy jest sprawdzenie na endpoincie. Ukryty przycisk nie jest zabezpieczeniem.

### Moduł `identity` (remote, port 4207)

Pełny przepis generowania: [`docs/frontend/new-module.md`](../frontend/new-module.md). Trzy strony:

| Strona | Zawartość |
|---|---|
| `/identity/users` | Lista z filtrami, szczegóły: przypisane role, uprawnienia bezpośrednie (z powodem), **efektywny zbiór z rozwinięciem „skąd"** |
| `/identity/roles` | Drzewo ról (TaigaUI), edycja uprawnień roli i jej składowych, podgląd „kto ma tę rolę" |
| `/identity/permissions` | Read-only katalog grupowany po module, „kto ma to uprawnienie", oznaczenie `obsolete` |

Ekran „skąd" nie jest ozdobą — to jedyne, co czyni zagnieżdżone role diagnozowalnymi.

---

## 7. Plan wdrożenia

### Faza 1 — AuthN end-to-end (bez uprawnień) ✅

Cel: prawdziwe logowanie, każdy endpoint za `[Authorize]`, zero zmian w logice biznesowej.

Zweryfikowane end-to-end: pełny przepływ Authorization Code + PKCE w przeglądarce
(`http://localhost:4200/login` → Keycloak → powrót zalogowany), `401` na każdym endpoincie
API bez tokenu, SignalR (`/hubs/sync`) łączy się z `access_token` w query stringu i poprawnie
grupuje po `sub`. Konto deweloperskie z `realm-erp.json`: `admin@erp.local` / `admin`.
Nieoczekiwana pułapka po drodze: FastEndpoints jest "secure by default" (patrz jego
dokumentacja), ale każdy `*Group.cs` w tym repo miał `ep.AllowAnonymous()` jako placeholder
sprzed Keycloaka — usunięte ze wszystkich 10 grup endpointów w Catalog/Notification/Sales.
Bez tego kroku żaden z powyższych elementów by nie zadziałał, mimo poprawnej konfiguracji auth.

| Element | Pliki |
|---|---|
| Keycloak w compose + realm | `backend/docker-compose.yml`, `backend/keycloak/realm-erp.json` |
| Pakiet JWT | `Directory.Packages.props` → `Microsoft.AspNetCore.Authentication.JwtBearer` |
| Walidacja tokenu | `Erp.BuildingBlocks.Api/Auth/ErpAuthExtensions.cs` (`AddErpAuth`), wpięcie w `AddErpApi`/`UseErpApi` |
| Tożsamość z tokenu | `ExecutionContextMiddleware` — `context.User` zamiast nagłówków; usunięcie `X-User-Id` |
| SignalR | `SyncHub` → `[Authorize]` + `Context.UserIdentifier` |
| Logowanie w SPA | `@erp/shared/auth`, `app.config.ts`, `LoginComponent`, `federation.config.mjs` (shared OIDC) |

**Weryfikacja:** logowanie w przeglądarce; wywołanie API bez tokenu → 401; SignalR odbiera zdarzenia zalogowanego użytkownika; `job` powstaje z prawdziwym `UserId`.

### Faza 2 — mikroserwis `Identity`, domena i katalog ✅

| Element | Pliki |
|---|---|
| 4 projekty Clean Architecture | `backend/modules/Identity/**` wg [`new-microservice.md`](./new-microservice.md), port **5280** |
| Katalog uprawnień | `Erp.BuildingBlocks.Contracts/Permissions.cs` + `PermissionDefinition` — 15 kodów startowych w Catalog/Sales/Notification/Identity |
| Agregaty | `Role` (`RolePermissionEntry`/`RoleMemberEntry` jako owned encje — EF nie mapuje `List<string>`/`List<Guid>` wprost jako encji własnej), `UserAccount` (`UserRoleGrant`/`UserPermissionGrant`) |
| Persystencja | `IdentityDbContext` (schemat `identity`), migracja `InitialIdentitySchema`, `PermissionCatalogReconciler` uzgadnia katalog przy KAŻDYM starcie (nie tylko na pustej bazie) |
| Zapytania | `IRoleQueries`/`IUserAccountQueries`/`IPermissionCatalogQueries` (rozbite z jednego `IIdentityQueries` z planu — czytelniejszy podział per agregat) — efektywne uprawnienia i ścieżka dziedziczenia surowym rekursywnym CTE przez dedykowane połączenie ADO.NET (`IdentityConnectionStringProvider` — Npgsql nie utrzymuje hasła w `DbConnection.ConnectionString` po otwarciu, więc odczyt connection stringa z już używanego przez EF połączenia zawodzi w runtime) |
| Endpointy | CRUD ról (`role/create`, `add-permission`, `add-member`...), nadawanie/odbieranie (`user/assign-role`, `grant-permission`...)¹, `GET /me/permissions`, `GET /me/permissions/sources` (ścieżka dziedziczenia), `GET /internal/users/{id}/permissions`, `GET /permission/catalog` |
| Seed | rola systemowa `administrator` (kod `RoleSeeder.AdministratorRoleCode`) z pełnym katalogiem, zsynchronizowana bezwarunkowo przy starcie (nie za flagą `Seed:Enabled` jak dane przykładowe — to strukturalny warunek wstępny, nie demo) |
| JIT provisioning | `Identity.Api/Provisioning/UserProvisioningMiddleware` — zakłada `user_account` przy pierwszym uwierzytelnionym żądaniu, pierwszy użytkownik w systemie dostaje `administrator` automatycznie. Wymagało nowego haka `configureBeforeEndpoints` w `ErpApiExtensions.UseErpApi` (opcjonalny, domyślnie no-op — inne serwisy nic nie płacą), bo middleware musi zobaczyć zweryfikowanego `context.User` i zdążyć przed dopasowaniem endpointu |
| Sygnatury | `AggregateSignatures`: `identity.user`, `identity.role` |

**Zweryfikowane end-to-end przez realne HTTP z tokenem Keycloaka** (nie tylko testy jednostkowe): utworzenie dwóch ról, dodanie uprawnienia, złożenie hierarchii (`warehouse-manager` zawiera `warehouse-reader`), próba zamknięcia cyklu odrzucona z `role_cycle_detected`, `GET /me/permissions` zwraca poprawny efektywny zbiór po przypisaniu zagnieżdżonej roli, `GET /me/permissions/sources` poprawnie atrybutuje `catalog.product.read` do `warehouse-reader` z `viaContainerRoleUuid` wskazującym `warehouse-manager`. `dotnet build`/`dotnet test` na całym rozwiązaniu (45/45) i `Erp.ArchitectureTests` (5/5) bez regresji.

¹ Nazwy tras w tej tabeli opisują stan Fazy 2. Od Fazy 7 wszystkie dziesięć komend `role/*`/`user/*`
idzie przez odpowiednik `BatchEndpointBase` pod trasami `role/batch-*`/`user/batch-*` —
patrz [Faza 7](#faza-7--operacje-masowe-) niżej i [`identity-bulk-migration.md`](./identity-bulk-migration.md).

**Znany dług, świadomie odłożony:** wyjątki domenowe (`DomainException`, np. `role_cycle_detected`) kończą się dziś generycznym 500, nie 422 — to nie jest regresja Fazy 2, tylko brak middleware komend opisany w [`cqrs.md` §6](./cqrs.md#6-czego-jeszcze-nie-ma) jako nieistniejący w całym repo. `GET /internal/users/{id}/permissions` dziś wymaga tylko ważnego tokenu (dowolny zalogowany użytkownik może odpytać o cudze uprawnienia) — docelowa polityka service-to-service to zadanie Fazy 3. Od Fazy 7 ten dług jest bez znaczenia dla `role/*`/`user/*`: błąd domenowy trafia do `job_item.error_code` w raporcie zadania, nie do kodu odpowiedzi HTTP synchronicznego żądania — droga synchroniczna, dla której 422 miałoby sens, przestała istnieć.

### Faza 3 — egzekwowanie w pozostałych serwisach ✅

| Element | Pliki |
|---|---|
| Dostawca uprawnień + cache | `Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs` (`IPermissionProvider`/`HttpPermissionProvider`, cache TTL=60s w `IMemoryCache`), `PermissionClaimsTransformation.cs` (dokłada claimy `permissions`, które czyta `Permissions(...)` FastEndpoints) |
| Rejestracja | `ErpAuthExtensions.AddErpPermissions` — wołane z `AddErpAuth`, więc każdy mikroserwis dostaje to automatycznie przez `AddErpApi`. Nowy parametr `enablePermissionClaims` (domyślnie `true`) — patrz "odstępstwo" niżej |
| Adnotacje endpointów | wszystkie 20 endpointów `Catalog.Api/**` (produkty, kategorie, joby — modele/multimedia/gwarancje/typy kodów/atrybuty pod wspólnym `catalog.dictionary.read`), 3 `Sales.Api/**`, **celowo pominięte** 2 `Notification.Api/**` (patrz niżej) |
| Nowe kody uprawnień | `Permissions.Catalog.DictionaryRead`, `Permissions.Catalog.JobControl` dopisane do katalogu (uzgodnią się w `permission_catalog` przy najbliższym starcie Identity) |

**Odstępstwo od pierwotnego planu — brak `UserPermissionsChanged` i konsumenta unieważniającego.** Zamiast nowego, bespoke kontraktu integracyjnego, cache jest wyłącznie TTL=60s. To świadoma uproszczenie, nie zaległość: dokumentowane SLA (§4: „≤30-60 s") jest spełnione samym TTL bez potrzeby nasłuchu na `AggregateChanged` z sygnaturami `identity.user`/`identity.role`. Aktywne unieważnianie zostaje możliwą optymalizacją czasu reakcji na później, nie warunkiem poprawności — dopisane jako pozycja w §9.

**Notification celowo BEZ `Permissions(...)`.** `job/searchJob`/`getJob` karmią dzwonek powiadomień własnymi zadaniami użytkownika — to nie jest zasób uprzywilejowany, tylko osobisty feed. Zagrodzenie go `notification.job.read` odcięłoby każdego nowego użytkownika bez wyraźnie nadanego uprawnienia od widoku WŁASNYCH powiadomień. Kod uprawnienia zostaje w katalogu jako zarezerwowany (analogicznie do nieużywanego jeszcze `catalog.product.bulk`), na wypadek przyszłego uprzywilejowanego widoku "zobacz zadania wszystkich".

**Napotkany i naprawiony w trakcie problem — rekurencja sieciowa w Identity.** Włączenie `PermissionClaimsTransformation` na WSZYSTKICH serwisach jednakowo (w tym na samym Identity) powodowało, że `GET /internal/users/{id}/permissions` wywoływało samo siebie przez HTTP w nieskończoność — żądanie do tego endpointu też przechodzi przez tę samą transformację klaimów, która znowu woła ten sam endpoint. Kestrel wyczerpywał pulę połączeń i się zawieszał (500/timeout zamiast odpowiedzi). Naprawione parametrem `enablePermissionClaims: false` przekazywanym z `Identity.Api/Program.cs` do `AddErpApi` — Identity i tak nie ma dziś własnych endpointów bramkowanych przez `Permissions(...)` (patrz "znany dług" niżej), więc nic nie traci.

**Napotkany i naprawiony w trakcie problem — brak tokenu w wywołaniu serwis-do-serwisu.** Pierwsza wersja `HttpPermissionProvider` wołała Identity bez żadnego nagłówka `Authorization` — Identity (samo za tym samym fallback policy z Fazy 1) odrzucała to 401-ką, więc KAŻDY użytkownik, łącznie z administratorem, dostawał pusty zbiór uprawnień i 403 wszędzie. Naprawione przekazywaniem dalej tokenu żądania, które wywołało transformację (`IHttpContextAccessor` w `PermissionClaimsTransformation`) — działa, bo dziś każdy ważny token wystarczy na `/internal/...` (ten sam odłożony dług co w Fazie 2).

**Zweryfikowane end-to-end przez realne HTTP z tokenem Keycloaka:** `searchProduct` z administratorem → 200; odebranie ról administratora (systemowej i testowej) → **403 dopiero po odczekaniu pełnego TTL cache'u (~60s)**, dokładnie zgodnie z udokumentowanym SLA, nie natychmiast — co samo w sobie potwierdza, że mechanizm cache'u faktycznie działa, a nie tylko "zawsze przepuszcza". Ponowne nadanie roli przywróciło dostęp. `dotnet test` na całym rozwiązaniu — 45/45, bez regresji.

**Znany dług, świadomie odłożony:** Identity NIE bramkuje własnych endpointów (`role/create`, `user/assign-role`...) przez `Permissions(...)` — dziś każdy zalogowany użytkownik może zarządzać rolami. Powód: `UserProvisioningMiddleware` (JIT) biegnie PO `PermissionClaimsTransformation` w potoku ASP.NET Core (uwierzytelnianie przed `ExecutionContextMiddleware`/customowymi hakami), więc pierwsze żądanie zupełnie nowego użytkownika miałoby permission cache zapisany jako PUSTY (bo `user_account` jeszcze nie istnieje) na 60 sekund — zanim JIT zdąży nadać `administrator`. Włączenie bramkowania na Identity bez naprawy tej kolejności zablokowałoby świeżo utworzonych administratorów na minutę. Naprawa (np. invalidacja cache'u zaraz po JIT, albo przesunięcie provisioningu przed autentykacją) to zadanie na Fazę 5 razem z bramkowaniem UI, nie coś do zrobienia w pośpiechu tutaj.

### Faza 4 — moduł frontendowy `identity` ✅ (szkielet), 📐 (trzy strony z §6)

Wygenerowany dokładnie wg [`new-module.md`](../frontend/new-module.md): 5 warstw (`contract`, `feature`, `ui`, `data-access`, `util`, port **4207**), `federation.config.mjs`, rejestracja w `REMOTE_MODULES_CONFIG`, `module-loaders.ts`, `app.routes.ts`, `remote-api.providers.ts` → `http://localhost:5280`, reguła `scope:identity` w `eslint.config.mjs` (root + `scope:host`), aliasy w `tsconfig.base.json`, tłumaczenia `pl-PL`/`en-US` przez `pnpm translate:keys`.

**Zweryfikowane end-to-end w przeglądarce** (nie tylko build): zalogowanie, przejście na `/identity/dashboard`, placeholder z poprawnie przetłumaczoną treścią, pozycja "Tożsamość" w szufladzie nawigacji obok pozostałych modułów. `npx nx lint` na wszystkich 6 nowych projektów + `client`/`client-contract`, build monolit (dev) i MFE (`identity:build:production` + `client:build:production`) — wszystko bez błędów.

**Świadomie odłożone do kolejnej iteracji — trzy właściwe strony (§6).** Ten przebieg dostarczył kompletny, działający SZKIELET modułu (routing, menu, federacja, tłumaczenia) z jedną stroną-placeholderem, zgodnie z Krokiem 4.3 przepisu ("`data-access`/`ui`/`util` mogą być puste na start"). `Users`/`Roles`/`Permissions` (klient NSwag z OpenAPI Identity, orkiestratory z `signalrSignature: 'identity.user'`/`'identity.role'`, realne tabele/formularze) to osobny, dobrze odizolowany przyrost — nie jest wymagany, żeby moduł "istniał" i żeby Faza 5 (bramkowanie UI) miała się do czego podłączyć.

**Napotkane i naprawione w trakcie problemy:**
1. **Generator `@nx/angular:remote` domyślnie scaffolduje pod Webpack Module Federation**, nie Native Federation — dopisał `@nx/module-federation`/`@nx/webpack`/`@module-federation/enhanced` do `package.json` i webpack-owy `project.json`. Odrzucone: usunięte niepotrzebne zależności (`pnpm install` po przywróceniu `package.json`), `project.json` zastąpiony w całości szablonem hybrydowym z `new-module.md`, wygenerowany `module-federation.manifest.json` poprawiony z `/mf-manifest.json` (webpack) na `/remoteEntry.json` (Native Federation).
2. **`tsconfig.base.json` — te same błędy, przed którymi ostrzega dokument**: generator dodał aliasy bez prefiksu `@erp/identity/` (`"contract"`, `"feature"`...) i osierocony wpis `"identity/Routes"` wskazujący na usunięty plik `remote-entry/entry.routes.ts`. Poprawione ręcznie na `@erp/identity/*`.
3. **`app.config.ts` wg dosłownego szablonu z dokumentu (`contractLoader: () => import(...)`) nie przechodzi lintu** — `@nx/enforce-module-boundaries` odrzuca plik, który zarówno statycznie, jak i dynamicznie importuje tę samą bibliotekę. Rzeczywisty działający wzorzec (potwierdzony na `catalog`) to statyczny import `remoteRoutes`/`remoteModalIds`/`registerModals`/`getModalProviders` przekazywanych wprost do `provideRemoteDevSupport(...)`, bez `contractLoader`. Dokument wymaga poprawki — patrz TODO niżej.
4. **Puste klucze tłumaczeń mimo poprawnego `pl-PL.json`** — strona pokazywała surowe `identity.dashboard.title` zamiast tekstu. Przyczyna: scope Transloco trzeba zarejestrować w `providers: [provideIdentityTranslations()]` SAMEGO routowanego komponentu (wzorzec z `ProductComponent` w Catalogu), nie wystarczy sam import kluczy — dokument o tym nie wspomina explicite poza ogólnym odesłaniem do `translations.md`.

**TODO dla dokumentacji:** `docs/frontend/new-module.md` Krok 3.6 (`app.config.ts`) pokazuje wzorzec z `contractLoader`, który realnie nie przechodzi lintu — do zamiany na wzorzec ze statycznymi importami (jak w tym module i w `catalog`).

### Faza 5 — bramkowanie UI ✅

| Element | Pliki |
|---|---|
| Katalog kodów uprawnień (kopia `Permissions.cs` po stronie frontu) | `libs/shared/auth/src/lib/permission-codes.ts` (`ERP_PERMISSIONS`) |
| `PermissionStore` | `libs/shared/auth/src/lib/permission.store.ts` — goły `HttpClient` na `GET {IDENTITY_PERMISSIONS_API_BASE_URL}/me/permissions`, fail-closed (błąd → pusty zbiór, nie wyjątek) |
| `erpPermissionGuard` / `*erpHasPermission` | `libs/shared/auth/src/lib/erp-permission.guard.ts` / `erp-has-permission.directive.ts` — obie w `shared/auth` (nie `shared/ui`), bo `type:ui` nie wolno zależeć od `type:auth` |
| Filtr menu po `requiredPermission` | `STARTUP.ts` (`filterMenuByPermissions`) — rekurencyjnie usuwa pozycje bez uprawnienia i opróżnione grupy, liczony raz przy starcie po `await permissionStore.load()` |
| Strona `/forbidden` | `libs/shared/ui/src/lib/auth/forbidden/erp-forbidden.component.ts`, trasa w `libs/client/contract/src/lib/app.routes.ts` |
| Toast na 403 | `apps/client/src/app/erp-permission-error.interceptor.ts` przez `ErpToastBridgeService`/`ErpToastBridgeComponent` (patrz „napotkany problem" niżej) |
| Odświeżanie po SignalR | `STARTUP.ts` — subskrypcja sygnatury `identity.user`, `permissionStore.load()` ponownie na zdarzenie dot. własnego `userId`. Samo menu **nie** jest przebudowywane na to zdarzenie (świadome uproszczenie) |
| Zastosowanie | Trasa i pozycja menu Catalogu zbramkowane `catalog.product.read`; akcje toolbara „Ustaw nazwę"/„Ustaw ceny" (jedyne realnie podłączone do komend masowych) schowane bez `catalog.product.bulk`; sekcja „Zarządzanie rolami" w placeholderze Identity jako przykład `*erpHasPermission` na całej sekcji |
| Naprawione przy okazji | `secureRoutes` w `app.config.ts` nie miał portu Identity (5280) — bez tego `/me/permissions` leciałoby bez tokenu; `sales`/`inventory` nie miały w ogóle `erpAuthGuard` na trasach (luka z Fazy 1) |

**Świadomie pominięte moduły bez realnego bramkowania:** `inventory`/`dms`/`task-management` nie mają w backendowym katalogu żadnych kodów uprawnień, a menu wszystkich czterech modułów (`sales` włącznie) wskazuje dziś na fasadowe, nieistniejące trasy z wcześniejszych faz — dopisanie tam `requiredPermission`/`erpPermissionGuard` byłoby fabrykowaniem ochrony nad kodem, który nic nie robi. Dostały tylko naprawę realnej luki (`erpAuthGuard`), nie `erpPermissionGuard`.

**Napotkany i naprawiony w trakcie problem — `TuiAlertService` nie da się wstrzyknąć poza `<tui-root>`.** Pierwsza wersja interceptora 403 wołała `inject(TuiAlertService)` bezpośrednio. `TuiAlertService` dziedziczy z `TuiPortal`, którego konstruktor robi `inject(TuiPopupService)` — a `TuiPopupService` jest dostarczany lokalnie przez `<tui-popups>`, komponent **wewnątrz szablonu `TuiRoot`**, widoczny tylko przez nazwany slot `tuiOverContent`. Zawartość projektowana do domyślnego slotu `<tui-root>` (czyli m.in. `<router-outlet>` w `app.html`) dostaje injector z miejsca deklaracji (`App`), nie z pozycji w drzewie DOM, więc nigdy nie widzi `TuiPopupService` — stąd `NG0201: No provider found for TuiAlertService` przy KAŻDYM requeście przechodzącym przez interceptor, nie tylko przy 403. Naprawione własnym, prostym komponentem toastu (`ErpToastBridgeService`/`ErpToastBridgeComponent`, `apps/client`) stylowanym tokenami `--tui-*`, bez zależności od portalowego API TaigaUI.

**Znany dług, świadomie odłożony:** filtr menu liczy się raz przy starcie — odświeżenie uprawnień przez SignalR (`identity.user`) odświeża `PermissionStore`, ale już zarejestrowane menu zostaje takie, jak przy starcie (guardy tras i realne wywołania API i tak korzystają ze świeżego stanu). Dynamiczne przebudowanie menu to kandydat na Fazę 6.

**Weryfikacja:** `npx nx lint` na wszystkich dotkniętych projektach bez nowych błędów (baseline potwierdzone przez `git stash`). `pnpm translate:keys` bez błędów. `npx nx run client:esbuild:development` przechodzi.

**Zweryfikowane end-to-end w przeglądarce z realnymi Keycloak + Catalog + Notification + Identity:**
- `admin@erp.local` (pierwszy user, JIT → rola `administrator`, pełny katalog uprawnień): `/catalog/products` przechodzi przez `erpPermissionGuard`, renderuje realne dane (1500 rekordów); po zaznaczeniu wierszy przyciski „Ustaw nazwę"/„Ustaw ceny" widoczne (ma `catalog.product.bulk`).
- Nowo utworzony `testuser@erp.local` (zero ról — JIT `administrator` dostaje tylko PIERWSZY user w systemie): `GET /me/permissions` zwraca `[]`; pozycja „Katalog" znika z menu; ręczne wejście w `/catalog/products` → przekierowanie na `/forbidden` z czytelnym komunikatem, **bez wylogowania**; bezpośrednie `POST /product/searchProduct` z tokenem testusera → realne `403` z backendu (Faza 3 nadal jedynym źródłem prawdy); toast (`ErpToastBridgeService`/`Component`) renderuje się poprawnie.

**Napotkany i naprawiony w trakcie problem — wyścig `STARTUP()` vs `checkAuth()`.** `provideAppInitializer(STARTUP)` i `withAppInitializerAuthCheck()` to dwa NIEZALEŻNE initializery — Angular nie gwarantuje ich kolejności (uruchamiają się równolegle). Pierwsza wersja `PermissionStore.load()` w `STARTUP.ts` odpalała się więc czasem PRZED tym, jak `checkAuth()` zdążył ustawić token w `erpAuthInterceptor`, dostawała 401 i (w odróżnieniu od SignalR, które ma `withAutomaticReconnect()`) zostawała z pustym zbiorem uprawnień NA STAŁE — mimo poprawnego zalogowania. Naprawione nową metodą `ErpAuthService.waitUntilAuthReady()` (opakowuje `isAuthenticated$`, ten sam mechanizm co `erpAuthGuard` — emituje dopiero PO `checkAuth()`), na którą `STARTUP.ts` czeka przed pierwszym `permissionStore.load()`.

### Faza 6 — audyt i domknięcie ✅

| Element | Pliki |
|---|---|
| `grant_audit` (append-only) | `Identity.Domain/Aggregates/Audit/GrantAuditEntry.cs` (plain `Entity`, bez `xmin` — nie jest `AggregateRoot`), `Identity.Infrastructure/Persistence/Configurations/Audit/GrantAuditEntryConfiguration.cs`, migracja `20260819124324_AddGrantAudit`, `IGrantAuditWriter`/`GrantAuditWriter` (zapis w tej samej transakcji co handler, bez własnego `SaveChangesAsync`), `IGrantAuditQueries`/`GrantAuditQueries` — `POST /grant-audit/search`, `POST /grant-audit/getGrantAudit` (ungated, read-only, wzorem `SearchRole`/`GetRole`) |
| Wpięcie audytu w handlery | 8 handlerów w `UserCommands.cs`/`RoleCommands.cs` (assign/revoke role, grant/revoke permission, add/remove member, add/remove permission) wołają `IGrantAuditWriter.RecordAsync` (samo `Add()`, bez własnego zapisu — patrz Faza 7²); actor zawsze z `IExecutionContext.UserId`, nigdy z payloadu |
| Czyszczenie wygasłych nadań | `Identity.Infrastructure/Jobs/ExpiredGrantCleanupService.cs` — pierwszy `BackgroundService`/`PeriodicTimer` w repo (co 5 min), usuwa `user_role` z `expires_at <= now()`, zapisuje `grant_audit` (`action=role_grant_expired`, `source=cleanup-job`). Higiena audytu, nie warunek poprawności — efektywne uprawnienia i tak już respektowały `expires_at` od Fazy 2 |
| Wymuszone wylogowanie | `backend/keycloak/realm-erp.json` — nowy klient poufny `erp-identity-service` (service-account, rola `manage-users` na `realm-management`); `Erp.BuildingBlocks.Api/Auth/{KeycloakAdminOptions,IKeycloakAdminClient,KeycloakAdminClient}.cs` (zwykły `HttpClient`, `client_credentials` do Keycloaka, `POST /admin/realms/erp/users/{sub}/logout`); `IPermissionProvider.InvalidateAsync` (nowa metoda, czyści `IMemoryCache`); `UserForceLogoutCommand`/handler, `POST /user/{uuid}/force-logout` (gated `identity.user.manage`) |
| Naprawa JIT vs claims transformation + bramkowanie Identity | `IUserProvisioningService`/`UserProvisioningService` (logika wydzielona z usuniętego `UserProvisioningMiddleware`), `Identity.Api/Auth/IdentityInProcessPermissionProvider.cs` — liczy efektywne uprawnienia bezpośrednio przez `IUserAccountQueries` (bez HTTP self-call, usuwa przyczynę dawnej rekurencji), woła `EnsureProvisionedAsync` PRZED policzeniem uprawnień, więc nowy użytkownik nigdy nie dostaje pustego cache'u na 60s. `Program.cs`: `enablePermissionClaims: true`, `IPermissionProvider` nadpisany na provider in-process. `Permissions(identity.role.manage)`/`Permissions(identity.user.manage)` dodane na `role/*`/`user/*`/`force-logout`; `me/permissions*`, `permission/catalog`, `GetRole`/`SearchRole`/`GetUser`/`SearchUser`, `grant-audit/*` zostają bez wymogu uprawnień (własny profil / katalogi i historia read-only) |
| Frontend — przebudowa menu na żywo | `apps/client/src/app/STARTUP.ts` — niefiltrowane drzewa menu per moduł zachowane po starcie; handler SignalR `identity.user` po `permissionStore.load()` przelicza `filterMenuByPermissions` i re-rejestruje przez `ErpNavRegistryService.register()` (już upsertuje po `id` — nie wymagało zmian w rejestrze) |
| Frontend — ekran historii nadań | Pierwsza właściwa strona modułu `identity`: `libs/modules/identity/{data-access,feature,contract}/**` — orkiestrator na regenerowanym kliencie NSwag (`searchGrantAudit`), tabela TaigaUI (kiedy/kto/komu/akcja+co/źródło), trasa `/identity/grants` i pozycja menu "Historia nadań" za `identity.role.manage` |

² Opis z Fazy 6: w tamtym momencie handler faktycznie wołał `IUnitOfWork.SaveChangesAsync` sam,
zaraz po zapisie audytu. Od Fazy 7 zapis wyznacza `BulkCommandRunner` (jeden raz na chunk) —
`IGrantAuditWriter` i tak zawsze robił samo `Add()`, więc wpis audytowy nadal ląduje w TEJ SAMEJ
transakcji co zmiana, którą opisuje, tylko że transakcję otwiera i zamyka runner, nie handler.

**Zweryfikowane:** `dotnet build`/`dotnet test` na całym rozwiązaniu — 45/45 bez regresji (5
`Erp.ArchitectureTests` + 40 `Catalog.Tests`), `Erp.ArchitectureTests` bez regresji warstw
Clean Architecture. `npx nx lint`/`pnpm translate:keys`/`npx nx run client:esbuild:development`
bez błędów.

**Zweryfikowane end-to-end w przeglądarce i przez realne Keycloak Admin API (konto
`administrator` + `testuser@erp.local`):**
- Strona `/identity/grants`: grid layout z panelem filtrów (UUID podmiotu, typ podmiotu,
  akcja — dopasowane do faktycznie filtrowalnych pól `SearchGrantAuditRequest`, bez pól-widm
  które backend by ignorował), `POST /grant-audit/search` zwraca 200 i realne wiersze; pozycja
  "Historia nadań" widoczna w menu pod "Tożsamość" za `identity.role.manage`, poprawnie
  ukryta dla `testuser` bez tego uprawnienia. Sekcja "Zarządzanie rolami" na dashboardzie
  nadal widoczna dla administratora (brak regresji po dodaniu `Permissions(...)` na
  endpointach Identity).
- **Audyt nadań:** `POST /user/assign-role` (rola `warehouse-reader` → `testuser`) zapisało
  wiersz `role_assigned` w `grant_audit` z poprawnym `actor_user_uuid` (administrator) i
  `subject_uuid` (testuser), widoczny natychmiast na stronie audytu.
- **Wymuszone wylogowanie:** klient service-account `erp-identity-service` utworzony przez
  Keycloak Admin API (bez reimportu realm — dodatkowo, nieniszcząco, na działającym
  kontenerze), rola `manage-users` z `realm-management` nadana i potwierdzona działającym
  tokenem `client_credentials`. `POST /user/{uuid}/force-logout` z tokenem administratora →
  200; sesja Keycloak `testuser` (uprzednio zalogowanego przez prawdziwy przepływ hasła)
  **realnie zniknęła** z `GET /admin/realms/erp/users/{id}/sessions` (pusta lista), a próba
  odświeżenia starym `refresh_token` zwróciła `invalid_grant: Session not active` — dowód
  faktycznego odwołania sesji, nie tylko zapisu w logu. Wiersz `user_forced_logout` poprawnie
  w `grant_audit`.
- **Przebudowa menu na żywo:** `testuser` zalogowany w przeglądarce (zero ról, pozycja
  "Dashboard Analityczny Produktów" ukryta), administrator z DRUGIEJ karty nadał mu rolę
  `warehouse-reader` przez `POST /user/assign-role` — bez żadnego przeładowania strony
  testusera pozycja "Dashboard Analityczny Produktów" pojawiła się w drawerze w ciągu kilku
  sekund (SignalR `identity.user` → `permissionStore.load()` → re-filter → re-register).
  Potwierdza naprawę "znanego długu" z Fazy 5.

---

### Faza 7 — operacje masowe ✅

Wszystkie dziesięć komend `role/*`/`user/*` przeszło z wywołań synchronicznych na wspólny
mechanizm operacji masowych Catalogu/Sales (`BatchEndpointBase`/`BulkCommandRunner`, patrz
[`bulk-commands.md`](./bulk-commands.md)) — **każda** mutacja, nawet na jednym agregacie, jest
teraz zadaniem z jednym elementem. Pełny opis decyzji projektowych, kolejności wdrożenia i
weryfikacji end-to-end: [`identity-bulk-migration.md`](./identity-bulk-migration.md).

| Element | Pliki |
|---|---|
| Infrastruktura jobów | `IdentityDbContext : IJobDbContext`, migracja `AddBulkJobs` (`identity.job`/`identity.job_item`), `IPersistenceExceptionTranslator` (`ix_role_code`→`role_code_duplicate`, `ix_user_account_email`→`user_email_duplicate`), `job/cancel`+`job/retry-failed`, kod uprawnienia `identity.job.control` |
| Komendy `user/*` | `UserAssignRoleCommand`/`UserRevokeRoleCommand`/`UserGrantPermissionCommand`/`UserRevokePermissionCommand`/`UserForceLogoutCommand` — pole celu przemianowane na `Uuid` (kontrakt `IAggregateCommand`), handlery bez własnego `SaveChangesAsync`; trasy `user/batch-*` |
| Komendy `role/*` | `RoleCreateCommand`/`RoleAddPermissionCommand`/`RoleRemovePermissionCommand`/`RoleAddMemberCommand`/`RoleRemoveMemberCommand` — jw., `RoleCreateCommand.Uuid` generowany PO STRONIE KLIENTA (tryb `Commands[]` jest jedynym sensownym trybem tworzenia); trasy `role/batch-*` |
| Reguły wsadowe | `UserMustExistRule`, `RoleMustExistRule`, `ReferencedRoleMustExistRule` (współdzielona user/role), `PermissionCodeMustExistRule` (współdzielona, **nowe sprawdzenie** — synchroniczna ścieżka nigdy nie waliduje kodu uprawnienia), `RoleCodeUniqueRule`, `RoleGraphCycleRule` — jedyna linia obrony przed cyklem powstałym WEWNĄTRZ jednego wsadu, bo `IsDescendantAsync` czyta stan zacommitowany i nie widzi krawędzi z wcześniejszych elementów tego samego chunka |
| Testy | `backend/tests/Identity.Tests` (nowy projekt, wzorem `Catalog.Tests`) — 31 testów, nacisk na `RoleGraphCycleRuleTests` (para `A→B`+`B→A` w jednym wsadzie, cykl tranzytywny przez trzy elementy, cykl przez stan już zacommitowany) i `RoleCodeUniqueRuleTests` (duplikat wewnątrz wsadu) |
| Frontend | Klient NSwag zregenerowany (10 metod `*MultipleCommand`), orkiestratory z metodami wsadowymi (`erpBuildBatchTargets(scope)`) i single-target (`Commands: [command]`), 4 modale (`assign-role`/`grant-permission`/`add-permission`/`add-member`) na `ErpBatchStepBase`, pełny `ErpSelectionScope` na `/identity/users` i `/identity/roles` (patrz [`pages.md` §7](../frontend/pages.md#7-wariant-z-zaznaczeniem-wielokrotnym-i-panelem-szczegółu-jednego-wiersza)) |

**Zweryfikowane end-to-end w przeglądarce** (konto `administrator`): zaznaczenie wielu
użytkowników → toolbar pokazuje realny licznik zasięgu → modal „Nadaj rolę"/„Nadaj uprawnienie"
renderuje odznaki wszystkich celów → zadanie kończy się w ~1-2 s (jeden chunk, `IdlePollingInterval`).
`dotnet build`/`dotnet test` na całym rozwiązaniu — 76/76 bez regresji (5 `Erp.ArchitectureTests`
+ 40 `Catalog.Tests` + 31 `Identity.Tests`).

**Napotkany i naprawiony w trakcie problem — `ReferenceError: Must call super constructor`.**
Cztery kroki modali (`UserAssignRoleStepComponent` i trzy analogiczne) rzucały ten błąd przy próbie
otwarcia — `.setItems(this._roles)` czytało pole klasy synchronicznie PRZED wywołaniem `super()`
we własnym konstruktorze, co JS zabrania dla klas pochodnych. Błąd był w kodzie od Fazy 4/5
(nikt wcześniej nie otworzył tych modali na żywo w przeglądarce — TypeScript go nie łapie, bo to
błąd czasu wykonania, nie typów). Naprawione przeniesieniem zależności do zmiennych lokalnych
budowanych PRZED `super(config)`, z przypisaniem do pól `this.` dopiero po nim.

---

## 8. Kolejność i zależności

```
Faza 1 (AuthN) ──► Faza 2 (domena) ──► Faza 3 (egzekwowanie) ──► Faza 5 (bramkowanie UI)
                            └────────► Faza 4 (moduł UI) ───────┘
                                                                └──► Faza 6 (audyt) ──► Faza 7 (operacje masowe)
```

Faza 1 jest twardym warunkiem wstępnym: budowanie zarządzania uprawnieniami na `X-User-Id` z nagłówka daje ekrany, które wyglądają na działające, a niczego nie chronią.

---

## 9. Świadomie odłożone

| Temat | Kiedy wróci | Uwaga |
|---|---|---|
| **Zakres danych** (który magazyn, czyi kontrahenci) | Gdy pojawi się pierwszy wymóg „widzi tylko swoje" | Modelować jako **atrybut nadania** (opcjonalny filtr przy `role_permission`/`user_permission`), **nigdy** jako osobne kody uprawnień — inaczej katalog eksploduje kombinatorycznie. Wtedy też moment na decyzję o OpenFGA. |
| `deny` | Prawdopodobnie nigdy | Warunek wejścia: opisane pierwszeństwo w tym pliku przed pierwszą linijką kodu |
| Tabela domknięcia ról | Gdy CTE zacznie być wąskim gardłem | Wzorzec gotowy w `CategoryClosureMaintainer`, ale uwaga: DAG wymaga `MIN(depth)` na parze (przodek, potomek) |
| Wielofirmowość / tenant | Poza zakresem | Dotknie tokenu, schematów i każdego zapytania — osobny projekt |
| Backplane Redis dla cache uprawnień | Razem z drugą instancją Notification | Patrz `architecture.md` §7 |
| Aktywne unieważnianie cache'u uprawnień w konsumentach (Catalog/Sales) przez zdarzenie zamiast TTL | Gdy TTL=60s przestanie wystarczać | Faza 6 dodała `IPermissionProvider.InvalidateAsync`, ale tylko wymuszone wylogowanie w Identity go używa i tylko w PROCESIE, który obsłużył żądanie — patrz `architecture.md` §7. Aktywny fanout do Catalog/Sales (`AggregateChanged` na `identity.user`/`identity.role`) nadal nie istnieje; konsument istniałby w `Erp.BuildingBlocks.Messaging`, nie wymaga nowego kontraktu |
| Właściwa autoryzacja service-to-service dla `GET /internal/users/{id}/permissions` | Gdy pojawi się drugi konsument poza `HttpPermissionProvider` | Dziś dowolny ważny token wystarcza; docelowo client credentials Keycloaka albo izolacja sieciowa |
| `perm_ver` w JWT | Prawdopodobnie nigdy | Faza 6 świadomie NIE wprowadziła tego do tokenu — wymuszone wylogowanie działa przez odwołanie sesji Keycloak (Admin API) + invalidację cache'u, bez zmian w protocol mapperach, zweryfikowane end-to-end (sesja realnie odwołana, `refresh_token` odrzucony). Konsekwencja: już wydany access token JWT pozostaje ważny do naturalnego wygaśnięcia (brak introspekcji) — patrz `architecture.md` §7 |
| Backplane dla wymuszonego wylogowania przy >1 instancji konsumentów uprawnień | Razem z backplane'em Redis dla cache'u uprawnień | Patrz `architecture.md` §7, nowy wiersz "Wymuszone wylogowanie (Faza 6)" |
