# Tożsamość i uprawnienia — Keycloak (AuthN) + moduł Identity (AuthZ)

Stan: **Fazy 1-2 ✅ wdrożone i zweryfikowane end-to-end** (realny Keycloak, realne logowanie
w przeglądarce, mikroserwis Identity z domeną ról/uprawnień, hierarchia z wykrywaniem cykli,
efektywne uprawnienia i ścieżka dziedziczenia, JIT provisioning). **Fazy 3-6 📐 projekt, brak
kodu.** Legenda znaczników jak w [`architecture.md` §1](./architecture.md#1-stan-wdrożenia).
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
| Endpointy | CRUD ról (`role/create`, `add-permission`, `add-member`...), nadawanie/odbieranie (`user/assign-role`, `grant-permission`...), `GET /me/permissions`, `GET /me/permissions/sources` (ścieżka dziedziczenia), `GET /internal/users/{id}/permissions`, `GET /permission/catalog` |
| Seed | rola systemowa `administrator` (kod `RoleSeeder.AdministratorRoleCode`) z pełnym katalogiem, zsynchronizowana bezwarunkowo przy starcie (nie za flagą `Seed:Enabled` jak dane przykładowe — to strukturalny warunek wstępny, nie demo) |
| JIT provisioning | `Identity.Api/Provisioning/UserProvisioningMiddleware` — zakłada `user_account` przy pierwszym uwierzytelnionym żądaniu, pierwszy użytkownik w systemie dostaje `administrator` automatycznie. Wymagało nowego haka `configureBeforeEndpoints` w `ErpApiExtensions.UseErpApi` (opcjonalny, domyślnie no-op — inne serwisy nic nie płacą), bo middleware musi zobaczyć zweryfikowanego `context.User` i zdążyć przed dopasowaniem endpointu |
| Sygnatury | `AggregateSignatures`: `identity.user`, `identity.role` |

**Zweryfikowane end-to-end przez realne HTTP z tokenem Keycloaka** (nie tylko testy jednostkowe): utworzenie dwóch ról, dodanie uprawnienia, złożenie hierarchii (`warehouse-manager` zawiera `warehouse-reader`), próba zamknięcia cyklu odrzucona z `role_cycle_detected`, `GET /me/permissions` zwraca poprawny efektywny zbiór po przypisaniu zagnieżdżonej roli, `GET /me/permissions/sources` poprawnie atrybutuje `catalog.product.read` do `warehouse-reader` z `viaContainerRoleUuid` wskazującym `warehouse-manager`. `dotnet build`/`dotnet test` na całym rozwiązaniu (45/45) i `Erp.ArchitectureTests` (5/5) bez regresji.

**Znany dług, świadomie odłożony:** wyjątki domenowe (`DomainException`, np. `role_cycle_detected`) kończą się dziś generycznym 500, nie 422 — to nie jest regresja Fazy 2, tylko brak middleware komend opisany w [`cqrs.md` §6](./cqrs.md#6-czego-jeszcze-nie-ma) jako nieistniejący w całym repo. `GET /internal/users/{id}/permissions` dziś wymaga tylko ważnego tokenu (dowolny zalogowany użytkownik może odpytać o cudze uprawnienia) — docelowa polityka service-to-service to zadanie Fazy 3.

### Faza 3 — egzekwowanie w pozostałych serwisach

| Element | Pliki |
|---|---|
| Kontrakt zdarzenia | `Erp.BuildingBlocks.Contracts/UserPermissionsChanged.cs` |
| Dostawca uprawnień + cache | `Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs`, `PermissionClaimsTransformation.cs` |
| Konsument unieważniający | `Erp.BuildingBlocks.Messaging` — rejestrowany w `AddErpMessaging` |
| Adnotacje endpointów | wszystkie `Catalog.Api/**` (produkty, kategorie, modele, multimedia, gwarancje, słowniki), `Sales.Api/**`, `Notification.Api/**` |
| Zadania masowe | zapis sprawdzonego uprawnienia w `job`; brak re-checku per chunk |
| Dopisek o jednej instancji | `docs/backend/architecture.md` §7 |

**Weryfikacja:** integracyjny test — odebranie roli → 403 na endpoincie w ciągu SLA; test, że każdy endpoint zapisu ma zadeklarowane uprawnienie (test refleksyjny w `Erp.ArchitectureTests`, żeby nowy endpoint nie wjechał bez ochrony).

### Faza 4 — moduł frontendowy `identity`

Generacja wg [`new-module.md`](../frontend/new-module.md) (port 4207, `scope:identity`, 5 warstw, `federation.config.mjs`, rejestracja w `REMOTE_MODULES_CONFIG`, `app.routes.ts`, `remote-api.providers.ts` → `http://localhost:5280`), klient NSwag, orkiestratory wg [`orchestrators.md`](../frontend/orchestrators.md) z `signalrSignature: 'identity.user'` / `'identity.role'`, tłumaczenia `pl-PL`/`en-US` + `pnpm translate:keys`. Trzy strony z §6.

**Weryfikacja:** `npx nx run-many -t lint,test,build`; nadanie roli w jednej karcie odświeża drugą przez SignalR.

### Faza 5 — bramkowanie UI

`erpPermissionGuard` na trasach modułów, `*erpHasPermission` na akcjach, `requiredPermission` w `remoteMenu`, bramkowanie toolbara operacji masowych spięte z istniejącym mechanizmem zaznaczenia ([`selection-scope.md`](../frontend/selection-scope.md)), obsługa 403 w interceptorze (komunikat, nie wylogowanie).

**Weryfikacja:** konto testowe bez `catalog.product.update` — brak przycisku, brak pozycji menu, ręczne wejście w URL kończy się 403 z czytelnym komunikatem.

### Faza 6 — audyt i domknięcie

Append-only `grant_audit` z ekranem historii nadań, wygasające nadania (`expires_at` + zadanie czyszczące), wymuszone wylogowanie (bump `perm_ver` + odwołanie sesji przez Admin API), aktualizacja [`CLAUDE.md`](../../CLAUDE.md) (wiersz w tabeli przepisów, mapa portów 4207/5280) i `docs/backend/architecture.md` (§1 stan wdrożenia, §7 cache).

---

## 8. Kolejność i zależności

```
Faza 1 (AuthN) ──► Faza 2 (domena) ──► Faza 3 (egzekwowanie) ──► Faza 5 (bramkowanie UI)
                            └────────► Faza 4 (moduł UI) ───────┘
                                                                └──► Faza 6 (audyt)
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
