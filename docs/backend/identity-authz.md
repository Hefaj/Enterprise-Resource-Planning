# Tożsamość i uprawnienia — Keycloak (AuthN) + moduł Identity (AuthZ)

**Stan: ✅ całość wdrożona i działa** — logowanie przez Keycloaka, mikroserwis `Identity`
z domeną ról/uprawnień (DAG z wykrywaniem cykli, efektywne uprawnienia, ścieżka dziedziczenia,
JIT provisioning), egzekwowanie w Catalog/Sales, bramkowanie UI, audyt nadań, wygasające
nadania, wymuszone wylogowanie, wszystkie komendy `role/*`/`user/*` jako operacje masowe.
Dokument opisuje **stan bieżący**: §1-6 mechanizmy i decyzje, §7 mapa plików, §8 pułapki,
§9 to, czego świadomie nie ma. Legenda znaczników — [`architecture.md` §1](./architecture.md#1-stan-wdrożenia).

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

Wariant tego samego CTE niosący tablicę ścieżki zasila ekran **„skąd to uprawnienie"** (§6) — bez niego zagnieżdżone role przestają być utrzymywalne po kilku miesiącach.

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
Keycloak ──JWT(sub)──► Catalog.Api
                          │
             IClaimsTransformation  (PermissionClaimsTransformation)
                          │
               IPermissionProvider  (IMemoryCache, TTL 60 s, klucz `perm:{userId}`)
                          │ miss
                          ▼
             GET Identity /internal/users/{id}/permissions
```

- **Token zostaje mały.** Zamiast wpychać kilkaset kodów w nagłówek `Authorization`, token niesie samo `sub` — zbiór uprawnień dociągany jest z Identity i cache'owany w procesie serwisu.
- **`IClaimsTransformation`** dokłada claimy `permissions` do `ClaimsPrincipal` z cache'u. Dzięki temu **wbudowany mechanizm FastEndpoints działa bez żadnej warstwy pośredniej**:

  ```csharp
  public override void Configure()
  {
      Put("/products/{uuid}/name");
      Permissions(Permissions.Catalog.ProductUpdate);
  }
  ```

- **TTL jest gwarancją, broadcast — czasem reakcji.** Nie ma `perm_ver` w tokenie (§9), ale każda zmiana efektywnych uprawnień rozsyła `PermissionsInvalidated` do **wszystkich** instancji **wszystkich** serwisów, więc cache czyści się w sekundę, a nie w minutę. Sygnał wychodzi z jednego miejsca — zapisu do `grant_audit` — bo obowiązuje niezmiennik „każda zmiana tego, kto co może, zostawia wpis w audycie", i idzie przez outbox, w tej samej transakcji co zmiana. Zepsuta kolejka unieważnień cofa system do samego TTL, czyli do zachowania sprzed tej zmiany: to optymalizacja, nie warunek poprawności.
- **SLA odwołania uprawnień: ≤ 60 s** (TTL cache). Zapisane, bo bez zapisanej liczby nikt tego nie przetestuje — i faktycznie tyle trwa: odebranie roli daje 403 dopiero po wygaśnięciu wpisu, nie natychmiast.
- **Identity nie woła samego siebie po HTTP.** W Identity `IPermissionProvider` jest nadpisany na [`IdentityInProcessPermissionProvider`](../../backend/modules/Identity/Identity.Api/Auth/IdentityInProcessPermissionProvider.cs), który liczy efektywne uprawnienia wprost przez `IUserAccountQueries` i wykonuje JIT provisioning **przed** ich policzeniem — patrz §8.
- **Niedostępne Identity = pusty zbiór uprawnień**, czyli 403, nie ciche przepuszczenie. Fail-closed jest tu decyzją, nie skutkiem ubocznym.

> Cache uprawnień zostaje **stanem w pamięci procesu** i to jest decyzja, nie zaległość. Wspólny
> cache w Redisie wkładałby go na ścieżkę każdego żądania każdego serwisu, w warstwie autoryzacji —
> awaria Redisa kładłaby wtedy cały ERP. Propagacja idzie więc komunikatem: osobna wymiana
> `erp.broadcast` i kolejka **per instancja**, bo `erp.events` wiąże jedną kolejkę per serwis
> i unieważnienie dotarłoby do jednej instancji zamiast do wszystkich. Patrz
> [`architecture.md` §7](./architecture.md#7-wieloinstancyjność--założenia-zdjęte).

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

### Tożsamość w backendzie idzie wyłącznie z tokenu

- [`ExecutionContextMiddleware`](../../backend/building-blocks/Erp.BuildingBlocks.Api/ExecutionContextMiddleware.cs) czyta `context.User`; nagłówek `X-User-Id` **nie istnieje** — każdy mógł nim podać cudze `userId`.
- `SyncHub` bierze tożsamość z `Context.UserIdentifier`, nie z query stringu ([`realtime-signalr.md`](./realtime-signalr.md)). Front podaje token przez `accessTokenFactory`; w query zostaje samo `clientId`.
- FastEndpoints jest „secure by default", więc **każde** `ep.AllowAnonymous()` w `*Group.cs` otwiera całą grupę endpointów — patrz §8.

---

## 6. Frontend

### `@erp/shared/auth`

- `angular-auth-oidc-client` (Authorization Code + PKCE, silent renew) pod fasadą [`ErpAuthService`](../../frontend/libs/shared/auth/src/lib/erp-auth-service.ts). **Musi być `shared` singleton w `federation.config.mjs`** każdego remota — dwie instancje biblioteki OIDC to dwie sesje i losowe wylogowania.
- Token żyje w `sessionStorage`/pamięci, **nie w `localStorage`** — `localStorage` wydłuża okno wykorzystania tokenu po XSS.
- [`PermissionStore`](../../frontend/libs/shared/auth/src/lib/permission.store.ts) — signal `Set<string>`, ładowany w `STARTUP.ts` z `GET /me/permissions`, odświeżany na sygnaturze SignalR `identity.user` dla własnego `userId`. Fail-closed: błąd HTTP daje pusty zbiór, nie wyjątek.
- `erpPermissionGuard('catalog.product.read')` obok `erpAuthGuard`, dyrektywa strukturalna `*erpHasPermission` dla przycisków i sekcji, strona `/forbidden` zamiast wylogowania, toast na 403 (`ErpToastBridgeService`).
- `requiredPermission` w pozycjach `remoteMenu` — shell filtruje menu w `STARTUP.ts` przed rejestracją, nie każdy moduł osobno. Menu jest **przeliczane na żywo**: po zdarzeniu `identity.user` dotyczącym własnego użytkownika `STARTUP.ts` ponownie ładuje uprawnienia, filtruje zapamiętane niefiltrowane drzewa i re-rejestruje je przez `ErpNavRegistryService.register()` (upsert po `id`).
- Kopia katalogu kodów po stronie frontu: [`permission-codes.ts`](../../frontend/libs/shared/auth/src/lib/permission-codes.ts) (`ERP_PERMISSIONS`) — dopisanie kodu w `Permissions.cs` wymaga dopisania go też tutaj.

### Katalog użytkowników dla pozostałych modułów

Task Management, DMS i każdy kolejny moduł wskazujący ludzi zapisują u siebie **wyłącznie uuid**
(claim `sub`). Nazwiska sklejają przez wspólny katalog: `user/searchUserDirectory` +
`user/getUserDirectory` (lekkie DTO: `uuid`, `displayName`, `email`, `isActive`), za **samym
uwierzytelnieniem** — to książka telefoniczna firmy, a nie dane administracyjne. Role, nadania
i historia zostają za `identity.user.read`/`identity.user.manage` na `searchUser`/`getUser`.

Po stronie frontu wchodzi to portem `ERP_USER_DIRECTORY` (`@erp/shared/util`) z implementacją
w `@erp/shared/data-access` — moduły nie widzą `@erp/identity/data-access`, bo `scope:*` pozwala
im zależeć wyłącznie od `scope:shared`. Szczegóły i wzorce użycia →
[`docs/frontend/user-directory.md`](../frontend/user-directory.md).

**Front tylko chowa UI.** Źródłem prawdy jest sprawdzenie na endpoincie. Ukryty przycisk nie jest zabezpieczeniem — `testuser` bez uprawnień dostaje realne 403 z backendu, niezależnie od tego, co widzi.

### Moduł `identity` (remote, port 4207)

| Trasa | Zawartość | Bramka |
|---|---|---|
| `/identity/dashboard` | Punkt wejścia modułu | `erpAuthGuard` |
| `/identity/users` | Lista z filtrami i zasięgiem zaznaczenia; panele: przypisane role, uprawnienia bezpośrednie (z powodem), **efektywny zbiór z rozwinięciem „skąd"** | `identity.user.read` |
| `/identity/roles` | Role z panelem składowych i „kto ma tę rolę", edycja uprawnień roli | `identity.role.read` |
| `/identity/permissions` | Read-only katalog grupowany po module, oznaczenie `obsolete` | `identity.permission.read` |
| `/identity/grants` | Historia nadań z `grant_audit` (kiedy/kto/komu/akcja/źródło) | `identity.role.manage` |

Ekran „skąd" nie jest ozdobą — to jedyne, co czyni zagnieżdżone role diagnozowalnymi.

Mutacje na obu stronach listowych idą przez pełny [`ErpSelectionScope`](../frontend/selection-scope.md) i modale na `ErpBatchStepBase` (`assign-role`, `grant-permission`, `add-permission`, `add-member`) — każda z nich jest operacją masową, patrz §7.
---

## 7. Mapa wdrożenia — gdzie co leży

### Uwierzytelnianie (AuthN)

| Element | Pliki |
|---|---|
| Keycloak w compose + realm | `backend/docker-compose.yml`, `backend/keycloak/realm-erp.json` (realm `erp`, klient publiczny `erp-client`, klient poufny `erp-identity-service` z rolą `manage-users`) |
| Walidacja tokenu | [`ErpAuthExtensions.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Auth/ErpAuthExtensions.cs) (`AddErpAuth`), wpięte w `AddErpApi`/`UseErpApi` — każdy mikroserwis dostaje to bez własnej konfiguracji |
| Tożsamość z tokenu | `ExecutionContextMiddleware` (`context.User`), `SyncHub` (`Context.UserIdentifier`) |
| Logowanie w SPA | `@erp/shared/auth`, `apps/client/src/app/app.config.ts`, `LoginComponent`, `federation.config.mjs` (OIDC jako `shared`) |
| Konto deweloperskie | `admin@erp.local` / `admin` z `realm-erp.json` |

### Domena Identity (AuthZ)

| Element | Pliki |
|---|---|
| Mikroserwis | `backend/modules/Identity/**` (4 projekty wg [`new-microservice.md`](./new-microservice.md)), port **5280**, schemat `identity` |
| Katalog uprawnień | [`Permissions.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/Permissions.cs) + `PermissionDefinition`; `PermissionCatalogReconciler` uzgadnia katalog z bazą przy **każdym** starcie |
| Agregaty | `Role` (`RolePermissionEntry`/`RoleMemberEntry` jako encje własne — EF nie mapuje `List<string>`/`List<Guid>` wprost), `UserAccount` (`UserRoleGrant`/`UserPermissionGrant`) |
| Zapytania | `IRoleQueries`/`IUserAccountQueries`/`IPermissionCatalogQueries` — efektywne uprawnienia i ścieżka dziedziczenia surowym rekursywnym CTE przez dedykowane połączenie ADO.NET (`IdentityConnectionStringProvider`, patrz §8) |
| Endpointy | `role/batch-*`, `user/batch-*` (patrz „Operacje masowe" niżej), `GET /me/permissions`, `GET /me/permissions/sources`, `GET /internal/users/{id}/permissions`, `GET /permission/catalog`, `grant-audit/*` |
| Seed | rola systemowa `administrator` (`RoleSeeder.AdministratorRoleCode`) z pełnym katalogiem, synchronizowana bezwarunkowo przy starcie — nie za flagą `Seed:Enabled`, bo to warunek wstępny, nie demo |
| JIT provisioning | `IUserProvisioningService`/`UserProvisioningService` wołane z `IdentityInProcessPermissionProvider` **przed** policzeniem uprawnień; pierwszy użytkownik w systemie dostaje `administrator` |
| Sygnatury SignalR | `AggregateSignatures`: `identity.user`, `identity.role` |

### Egzekwowanie i bramkowanie

| Element | Pliki |
|---|---|
| Dostawca uprawnień + cache | [`PermissionProvider.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs), `PermissionClaimsTransformation.cs` |
| Adnotacje endpointów | wszystkie endpointy `Catalog.Api/**` (modele/multimedia/gwarancje/typy kodów/atrybuty pod wspólnym `catalog.dictionary.read`), `Sales.Api/**`, w Identity wszystkie `role/batch-*` (`identity.role.manage`), `user/batch-*` (`identity.user.manage`) i `job/*` (`identity.job.control`) |
| **Celowo bez `Permissions(...)`** | `Notification.Api` (`job/searchJob`, `getJob`) — dzwonek karmi użytkownika JEGO zadaniami, to osobisty feed, nie zasób uprzywilejowany; zagrodzenie go odcięłoby nowego użytkownika od własnych powiadomień. Kod `notification.job.read` zostaje w katalogu jako zarezerwowany. W Identity ungated zostają `me/permissions*`, `permission/catalog`, `GetRole`/`SearchRole`/`GetUser`/`SearchUser`, `grant-audit/*` |
| Bramkowanie UI | `libs/shared/auth/**` (`PermissionStore`, `erpPermissionGuard`, `*erpHasPermission`), `STARTUP.ts` (`filterMenuByPermissions`), `erp-forbidden.component.ts`, `erp-permission-error.interceptor.ts` |
| Moduły bez bramkowania | `inventory`/`dms`/`task-management` nie mają żadnych kodów w katalogu, a ich menu wskazuje na fasadowe trasy — mają `erpAuthGuard`, nie `erpPermissionGuard`. Dopisanie tam `requiredPermission` byłoby fabrykowaniem ochrony nad kodem, który nic nie robi |

### Audyt, wygasanie, wymuszone wylogowanie

| Element | Pliki |
|---|---|
| `grant_audit` (append-only) | [`GrantAuditEntry.cs`](../../backend/modules/Identity/Identity.Domain/Aggregates/Audit/GrantAuditEntry.cs) (plain `Entity`, bez `xmin` — nie jest `AggregateRoot`), `IGrantAuditWriter`/`GrantAuditWriter` (samo `Add()`, zapis wyznacza runner — wpis ląduje w tej samej transakcji co zmiana, którą opisuje), `POST /grant-audit/search` |
| Wpięcie w handlery | 8 handlerów w `UserCommands.cs`/`RoleCommands.cs`; actor **zawsze** z `IExecutionContext.UserId`, nigdy z payloadu |
| Wygasające nadania | [`ExpiredGrantCleanupService.cs`](../../backend/modules/Identity/Identity.Infrastructure/Jobs/ExpiredGrantCleanupService.cs) — `BackgroundService`/`PeriodicTimer` co 5 min, usuwa `user_role` z `expires_at <= now()`, zapisuje `role_grant_expired`. Higiena audytu, nie warunek poprawności — efektywne uprawnienia respektują `expires_at` w samym CTE |
| Wymuszone wylogowanie | `KeycloakAdminOptions`/`IKeycloakAdminClient`/`KeycloakAdminClient` (`client_credentials`, `POST /admin/realms/erp/users/{sub}/logout`), `IPermissionProvider.InvalidateAsync`, `UserForceLogoutCommand`, trasa `user/batch-force-logout` (gated `identity.user.manage`). Sesja Keycloaka realnie znika; **już wydany access token pozostaje ważny do wygaśnięcia** — nie ma introspekcji (§9) |

### Operacje masowe — każda mutacja jest zadaniem

Wszystkie dziesięć komend `role/*`/`user/*` idzie przez `BatchEndpointBase`/`BulkCommandRunner`
([`bulk-commands.md`](./bulk-commands.md)); endpointy pojedyncze **nie istnieją**, akcja na jednym
obiekcie to zadanie z jednym elementem (~1-2 s: `EffectiveChunkSize` = 1, `IdlePollingInterval` = 2 s).

Trzy konsekwencje przyjęte świadomie:

- odpowiedź to `BatchResult { JobUuid }`, nie wynik operacji;
- błąd domenowy (`role_cycle_detected`, `role_code_duplicate`) przychodzi w raporcie zadania przez dzwonek powiadomień, nie jako 4xx — mapowanie `DomainException` na 422 ([`cqrs.md` §6](./cqrs.md#6-pipeline-komend)) istnieje, ale Identity go nie używa: droga synchroniczna, na której 422 miałoby sens, przestała istnieć;
- wiersz w tabeli odświeża się po `AggregateChanged` po commicie chunka, nie po odpowiedzi HTTP.

**Oś „wielu" dla ról to tryb `Commands[]`.** Naturalny przypadek to „dodaj 5 uprawnień do 1 roli",
czyli odwrotność „1 zmiana na N agregatów" z Catalogu. Lista komend **nie jest** odduplikowana po
agregacie, a wszystkie elementy chunka dzielą jeden scope DI i jedną transakcję — pięć wywołań
`role.AddPermission` trafia na tę samą śledzoną encję i daje jeden `UPDATE`. Wariant odwrotny
(„1 uprawnienie na N ról") obsługuje `TargetFilter`. Komendy wielowartościowe
(`RoleSetPermissionsCommand { Codes[] }`) są więc **niepotrzebne**.

| Element | Pliki |
|---|---|
| Infrastruktura jobów | `IdentityDbContext : IJobDbContext`, migracja `AddBulkJobs`, `IPersistenceExceptionTranslator` (`ix_role_code`→`role_code_duplicate`, `ix_user_account_email`→`user_email_duplicate`), `job/cancel`+`job/retry-failed`, uprawnienie `identity.job.control` |
| Komendy | `User{AssignRole,RevokeRole,GrantPermission,RevokePermission,ForceLogout}Command`, `Role{Create,AddPermission,RemovePermission,AddMember,RemoveMember}Command` — pole celu nazywa się `Uuid` (kontrakt `IAggregateCommand`), handlery bez własnego `SaveChangesAsync`. `RoleCreateCommand.Uuid` generuje **klient** (tryb `Commands[]` jest jedynym sensownym trybem tworzenia) |
| Reguły wsadowe | `UserMustExistRule`, `RoleMustExistRule`, `ReferencedRoleMustExistRule`, `PermissionCodeMustExistRule`, `RoleCodeUniqueRule`, `RoleGraphCycleRule` |
| Testy | `backend/tests/Identity.Tests` — nacisk na `RoleGraphCycleRuleTests` i `RoleCodeUniqueRuleTests` (duplikat/cykl **wewnątrz jednego wsadu**) |

**`RoleGraphCycleRule` jest jedyną obroną przed cyklem powstałym wewnątrz jednego wsadu.**
`IRoleQueries.IsDescendantAsync` idzie osobnym połączeniem ADO.NET i widzi wyłącznie stan
zacommitowany — para `A→B` i `B→A` w jednym zadaniu przeszłaby oba sprawdzenia i zamknęła cykl
w bazie. Reguła ładuje cały graf ról jednym zapytaniem i symuluje wstawienia w kolejności
`Ordinal`; sprawdzenie w handlerze zostaje jako druga linia obrony na stanie zacommitowanym.
Runner bierze jedno zadanie naraz i trzyma na nim `FOR UPDATE SKIP LOCKED`, więc również przy
wielu instancjach nad jednym zadaniem pracuje dokładnie jeden proces — te dwie warstwy pokrywają
całość. Patrz [`architecture.md` §7](./architecture.md#7-wieloinstancyjność--założenia-zdjęte).

> Komentarze w kodzie odsyłają miejscami do numerów faz wdrożenia. Odpowiadają obszarom wyżej:
> **1** AuthN, **2** domena Identity, **3** egzekwowanie w Catalog/Sales, **4** moduł frontendowy,
> **5** bramkowanie UI, **6** audyt i domknięcie, **7** operacje masowe.

---

## 8. Pułapki, które już raz kosztowały czas

Każda z nich jest do powtórzenia przy następnej zmianie w tym obszarze — dlatego są zapisane.

- **`ep.AllowAnonymous()` w `*Group.cs`.** FastEndpoints jest „secure by default", ale placeholdery sprzed Keycloaka otwierały całe grupy endpointów. Poprawna konfiguracja auth nie pomoże, dopóki gdzieś zostaje `AllowAnonymous`.
- **Serwis wołający własny endpoint uprawnień.** `PermissionClaimsTransformation` włączona w Identity powodowała, że `GET /internal/users/{id}/permissions` wywoływało samo siebie po HTTP w nieskończoność (żądanie do tego endpointu też przechodzi przez transformację). Kestrel wyczerpywał pulę połączeń — objaw to timeout, nie stack overflow. Dlatego Identity ma `IPermissionProvider` nadpisany na wariant in-process, a `AddErpApi` przyjmuje `enablePermissionClaims`.
- **Wywołanie serwis-do-serwisu bez tokenu.** `HttpPermissionProvider` musi przekazać dalej token żądania, które wywołało transformację — Identity stoi za tym samym fallback policy co reszta. Bez tego KAŻDY użytkownik dostaje pusty zbiór uprawnień i 403 wszędzie.
- **Npgsql nie utrzymuje hasła w `DbConnection.ConnectionString` po otwarciu.** Odczyt connection stringa z połączenia używanego przez EF działa w testach i wywala się w runtime — stąd `IdentityConnectionStringProvider` dla surowych CTE.
- **Dwa niezależne `provideAppInitializer`.** `STARTUP()` i `withAppInitializerAuthCheck()` startują równolegle — `PermissionStore.load()` potrafiło polecieć przed ustawieniem tokenu, dostać 401 i zostać z pustym zbiorem **na stałe** (brak retry, inaczej niż SignalR). Stąd `ErpAuthService.waitUntilAuthReady()` przed pierwszym `load()`.
- **`TuiAlertService` nie da się wstrzyknąć poza `<tui-root>`.** Dziedziczy z `TuiPortal` → `inject(TuiPopupService)`, a ten jest dostarczany przez `<tui-popups>` wewnątrz szablonu `TuiRoot`. Zawartość projektowana do domyślnego slotu (m.in. `<router-outlet>`) dostaje injector z miejsca deklaracji, nie z pozycji w DOM — `NG0201` przy każdym żądaniu przechodzącym przez interceptor. Stąd własny `ErpToastBridgeService`/`Component`.
- **Odczyt pola klasy przed `super()`.** Kroki modali (`.setItems(this._roles)` w argumencie `super(config)`) rzucają `ReferenceError: Must call super constructor` — TypeScript tego nie łapie, bo to błąd czasu wykonania. Zależności buduj w zmiennych lokalnych **przed** `super()`, przypisuj do `this.` po nim (patrz [`modals.md`](../frontend/modals.md)).

---

## 9. Świadomie odłożone

| Temat | Kiedy wróci | Uwaga |
|---|---|---|
| **Zakres danych** (który magazyn, czyi kontrahenci) | Gdy pojawi się pierwszy wymóg „widzi tylko swoje" | Modelować jako **atrybut nadania** (opcjonalny filtr przy `role_permission`/`user_permission`), **nigdy** jako osobne kody uprawnień — inaczej katalog eksploduje kombinatorycznie. Wtedy też moment na decyzję o OpenFGA. |
| `deny` | Prawdopodobnie nigdy | Warunek wejścia: opisane pierwszeństwo w tym pliku przed pierwszą linijką kodu (§2) |
| Tabela domknięcia ról | Gdy CTE zacznie być wąskim gardłem | Wzorzec gotowy w `CategoryClosureMaintainer`, ale uwaga: DAG wymaga `MIN(depth)` na parze (przodek, potomek) |
| Wielofirmowość / tenant | Poza zakresem | Dotknie tokenu, schematów i każdego zapytania — osobny projekt |
| `perm_ver` w JWT | Prawdopodobnie nigdy | Wymagałoby niestandardowego mappera Keycloaka odpytującego Identity przy KAŻDYM wystawieniu tokenu (SPI, osobny projekt). Sam TTL=60s spełnia SLA z §4, a wymuszone wylogowanie rozwiązuje pilny przypadek przez odwołanie sesji. Konsekwencja: już wydany access token żyje do naturalnego wygaśnięcia — nie ma introspekcji |
| ~~Aktywne unieważnianie cache'u uprawnień w Catalog/Sales~~ | **Zrobione** | `PermissionsInvalidated` na wymianie `erp.broadcast`, kolejka per instancja, handler w `Erp.BuildingBlocks.Messaging`; publikuje `GrantAuditWriter` przez outbox |
| `UserChanged` do denormalizacji nazw użytkowników w innych modułach | Gdy jakiś moduł zacznie wyświetlać nazwiska zamiast `userId` | Kontrakt nie istnieje; dziś nikt poza Identity nie pokazuje danych użytkownika |
| Właściwa autoryzacja service-to-service dla `GET /internal/users/{id}/permissions` | Gdy pojawi się drugi konsument poza `HttpPermissionProvider` | Dziś **dowolny ważny token wystarcza**, żeby odpytać o cudze uprawnienia; docelowo client credentials Keycloaka albo izolacja sieciowa |
| ~~Backplane Redis dla cache'u uprawnień~~ | **Odrzucone świadomie** | Redis na ścieżce autoryzacji każdego żądania wymagałby zaprojektowanej degradacji; propagacja idzie broadcastem RabbitMQ. Redis zostaje wyłącznie backplanem SignalR — [`architecture.md` §7](./architecture.md#7-wieloinstancyjność--założenia-zdjęte) |
| Rozszerzenie `GET /me/permissions/sources` na dowolnego użytkownika | Gdy panel „skąd" ma działać dla cudzego konta | Backend eksponuje ścieżkę dziedziczenia tylko dla `/me`; UI panelu efektywnych uprawnień już ma na to miejsce |
