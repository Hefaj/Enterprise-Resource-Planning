# Identity — przejście wszystkich komend na operacje masowe

**Stan: 📐 projekt, brak kodu.** Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).

Cel: **każda** mutacja w module Identity idzie tą samą drogą co operacje masowe Catalogu —
`BatchEndpointBase` → `job`/`job_item` → `BulkCommandRunner`. Dziś wszystkie 10 komend to
wywołania synchroniczne na pojedynczym agregacie, a [`IdentityDbContext`](../../backend/modules/Identity/Identity.Infrastructure/Persistence/IdentityDbContext.cs)
świadomie nie implementuje `IJobDbContext`.

Mechanika samego silnika jest opisana w [`bulk-commands.md`](./bulk-commands.md) i nie jest tu
powtarzana — ten dokument opisuje wyłącznie różnicę: co w Identity trzeba zmienić i w jakiej
kolejności.

---

## 1. Decyzje wejściowe

Trzy rzeczy musiały się rozstrzygnąć projektowo, zanim plan ma sens.

### 1.1 Jednolitość = każda mutacja jest zadaniem

Endpointy pojedyncze **znikają**; akcja na jednym obiekcie to zadanie z jednym elementem.
Konsekwencje przyjęte świadomie:

- odpowiedź to `BatchResult { JobUuid }`, nie wynik operacji;
- błąd domenowy (`role_cycle_detected`, `role_code_duplicate`) przychodzi w raporcie zadania
  przez dzwonek powiadomień, nie jako 4xx;
- wiersz w tabeli odświeża się po `AggregateChanged` (sygnatury `identity.user`/`identity.role`,
  już zarejestrowane) po commicie chunka, nie po odpowiedzi HTTP.

Przy jednym elemencie `EffectiveChunkSize` wynosi 1, a `IdlePollingInterval` 2 s — realne
opóźnienie to ~1-2 s. Catalog działa dokładnie tak od fazy 3.

### 1.2 Oś „wielu" dla ról to tryb `Commands[]`

Naturalny przypadek użycia dla ról to „dodaj 5 uprawnień do 1 roli", czyli odwrotność
„1 zmiana na N agregatów" z Catalogu. Kontrakt to obsługuje: lista komend **nie jest**
odduplikowana po agregacie (patrz `BatchEndpointBase.ValidateTargetsAsync`), a wszystkie
elementy jednego chunka dzielą jeden scope DI i jedną transakcję — pięć wywołań
`role.AddPermission` trafia na tę samą śledzoną encję i daje jeden `UPDATE`.

Wariant odwrotny („1 uprawnienie na N ról") obsługuje `TargetFilter`. Komendy wielowartościowe
(`RoleSetPermissionsCommand { Codes[] }`) są więc **niepotrzebne** — kontrakt bulk pokrywa oba
kierunki bez wyłomu w jednolitości.

### 1.3 Walidacja cyklu przenosi się do pre-checku

[`IRoleQueries.IsDescendantAsync`](../../backend/modules/Identity/Identity.Infrastructure/Queries/RoleQueries.cs)
idzie surowym SQL-em przez **osobne połączenie ADO.NET** (`IdentityConnectionStringProvider`),
więc nie widzi niezacommitowanych wierszy `role_member` z bieżącego chunka. Para `A→B` i `B→A`
w jednym zadaniu przeszłaby oba sprawdzenia i zamknęła cykl w bazie.

Rozwiązanie: reguła wsadowa ładuje cały graf ról **jednym** zapytaniem i symuluje wstawienia
w kolejności `Ordinal`. Sprawdzenie w handlerze zostaje jako druga linia obrony na stanie
zacommitowanym (cykle z wcześniejszych zadań). Runner jest jednowątkowy i bierze jedno zadanie
naraz, więc te dwie warstwy razem pokrywają całość — patrz
[`architecture.md` §7](./architecture.md#7-założenia-jednoinstancyjne).

---

## 2. Faza 0 — infrastruktura jobów

Bez zmiany zachowania istniejących endpointów. Osobny, samodzielnie wdrażalny krok.

| Krok | Plik / akcja |
|---|---|
| 0.1 | [`IdentityDbContext.cs`](../../backend/modules/Identity/Identity.Infrastructure/Persistence/IdentityDbContext.cs) — `: ErpDbContext, IJobDbContext`, `DbSet<Job> Jobs => Set<Job>()`, `DbSet<JobItem> JobItems => Set<JobItem>()`; w `OnModelCreating` dołożyć `ApplyConfiguration(new JobConfiguration())` i `new JobItemConfiguration()` — konfiguracje żyją w BuildingBlocks, więc `ApplyConfigurationsFromAssembly` ich nie złapie. Skasować komentarz „Bez `IJobDbContext`" |
| 0.2 | Migracja `AddBulkJobs` → tabele `identity.job` / `identity.job_item`. Stosuje się sama przez `ErpDatabaseMigrator<IdentityDbContext>` przy starcie |
| 0.3 | [`IdentityInfrastructureExtensions.cs`](../../backend/modules/Identity/Identity.Infrastructure/IdentityInfrastructureExtensions.cs) — rejestracja `IPersistenceExceptionTranslator` (mapa niżej) i poprawka komentarza klasy |
| 0.4 | [`Program.cs`](../../backend/modules/Identity/Identity.Api/Program.cs) — `AddScoped<IJobStore, JobStore<IdentityDbContext>>()` + `AddErpBulkJobs<IdentityDbContext>(builder.Configuration)` |
| 0.5 | `Identity.Api/Jobs/JobGroup.cs` + `JobControlEndpoints.cs` — `JobCancelEndpointBase<IdentityDbContext>` / `JobRetryFailedEndpointBase<IdentityDbContext>`, trasy `cancel` / `retry-failed`. Wzór: [`Catalog.Api/Jobs/JobControlEndpoints.cs`](../../backend/modules/Catalog/Catalog.Api/Jobs/JobControlEndpoints.cs) |
| 0.6 | [`Permissions.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/Permissions.cs) — `Identity.JobControl = "identity.job.control"` w klasie i w `Permissions.All`. `PermissionCatalogReconciler` dopisze kod do bazy przy najbliższym starcie |

Nowa migracja:

```bash
dotnet ef migrations add AddBulkJobs --project backend/modules/Identity/Identity.Infrastructure --startup-project backend/modules/Identity/Identity.Infrastructure --output-dir Persistence/Migrations
```

Mapa indeks unikalny → kod domenowy (nazwy z migracji `InitialIdentitySchema`):

```csharp
["ix_role_code"]          = "role_code_duplicate",
["ix_user_account_email"] = "user_email_duplicate",
```

Bez tej mapy masowe tworzenie ról raportowałoby `persistence_error` zamiast `role_code_duplicate`,
a element wracałby do puli ponowień, mimo że duplikat jest trwały — patrz
[`bulk-commands.md`](./bulk-commands.md#naruszenie-unikalności-to-reguła-biznesowa-nie-awaria).

**Świadomie NIE dodajemy** `identity.user.bulk` / `identity.role.bulk`. Endpointy batch zostają
za `UserManage` / `RoleManage` — akcja to nadal „zarządzanie użytkownikami", a osobny kod bulk
osierociłby dotychczasowe kody, skoro trybu pojedynczego już nie będzie. W Catalogu
`catalog.product.bulk` istnieje dlatego, że bramkuje przyciski toolbara **obok** zwykłego
`catalog.product.update`.

**Weryfikacja fazy:** `dotnet build`, start Identity, `\dt identity.*` pokazuje `job` i `job_item`,
`POST /job/cancel` z losowym uuid → 404 (nie 500).

---

## 3. Faza 1 — warstwa Application gotowa na runner

Po tej fazie handlery nie zapisują, więc **musi wejść jednym commitem** z Fazą 2 (dla `user/*`)
i z Fazą 3 (dla `role/*`).

### 3.1 Zmiana nazw pól na `Uuid`

Runner podstawia `item.AggregateUuid` w pole `Uuid` przez `BatchCommandPayload.Materialize` —
inna nazwa nie zadziała. Każda komenda dostaje `: ICommand<Guid>, IAggregateCommand`.

| Komenda | Zmiana |
|---|---|
| `UserAssignRoleCommand` | `UserUuid` → `Uuid` |
| `UserRevokeRoleCommand` | `UserUuid` → `Uuid` |
| `UserGrantPermissionCommand` | `UserUuid` → `Uuid` |
| `UserRevokePermissionCommand` | `UserUuid` → `Uuid` |
| `UserForceLogoutCommand` | `UserUuid` → `Uuid` |
| `RoleAddPermissionCommand` | `RoleUuid` → `Uuid` |
| `RoleRemovePermissionCommand` | `RoleUuid` → `Uuid` |
| `RoleAddMemberCommand` | `ContainerRoleUuid` → `Uuid`, `MemberRoleUuid` bez zmian |
| `RoleRemoveMemberCommand` | `ContainerRoleUuid` → `Uuid`, `MemberRoleUuid` bez zmian |
| `RoleCreateCommand` | **dodaj** `Uuid` — uuid nowej roli generuje klient; handler przechodzi na `Role.CreateWithUuid` (dziś zarezerwowane dla seedera — rozszerzyć komentarz o ten przypadek) |

To jest **łamiąca zmiana kontraktu NSwag**. Zgodnie z regułą z `CLAUDE.md` wymaga świadomej
regeneracji klienta, nie przypadkowego przemianowania — obsłużona w Fazie 4.

### 3.2 Usunięcie `SaveChangesAsync` z 10 handlerów

Runner woła `IUnitOfWork.SaveChangesAsync` **raz na chunk** — to właśnie czyni chunk transakcją.
Handler, który zapisuje sam, daje N commitów i psuje częściowy sukces: element, który już
zacommitował, nie cofnie się przy awarii chunka.

Wyrzucić wstrzyknięcie `IUnitOfWork` i wywołanie z
[`UserCommands.cs`](../../backend/modules/Identity/Identity.Application/Users/UserCommands.cs),
[`UserAuditCommands.cs`](../../backend/modules/Identity/Identity.Application/Users/UserAuditCommands.cs),
[`RoleCommands.cs`](../../backend/modules/Identity/Identity.Application/Roles/RoleCommands.cs).
Przepisać komentarz klasy `RoleCommands` — dziś opisuje dokładną odwrotność stanu docelowego.

Dwie rzeczy są już zgodne i nie wymagają zmian:

- `IGrantAuditWriter` robi tylko `Add()`, zapis zostawia wołającemu → wpisy `grant_audit` wejdą
  do tej samej transakcji co chunk;
- `IExecutionContext` jest odtwarzany przez runnera z `job.UserId`
  ([`BulkCommandRunner.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/BulkCommandRunner.cs)),
  więc `GrantedBy` i `actor_uuid` w audycie będą prawdziwym adminem, nie pustym GUID-em.

### 3.3 Reguły wsadowe — `Identity.Application/*/Rules/`

Wzór: [`ProductBatchValidator.cs`](../../backend/modules/Catalog/Catalog.Application/Products/Rules/ProductBatchValidator.cs),
mechanizm: [`batch-validation.md`](./batch-validation.md). Każda reguła robi **jedno** zapytanie
na cały wsad zamiast N.

| Reguła | Kod błędu | Uwagi |
|---|---|---|
| `UserMustExistRule : IBatchRule<Guid>` | `user_not_found` | |
| `RoleMustExistRule : IBatchRule<Guid>` | `role_not_found` | celuje w agregat `Role` |
| `ReferencedRoleMustExistRule : IBatchRule<RoleReferenceTarget>` | `role_not_found` | `RoleUuid` z `UserAssignRoleCommand` i `MemberRoleUuid` z `RoleAddMemberCommand`; zastępuje zapytanie per element z dzisiejszego `UserAssignRoleCommandHandler` |
| `PermissionCodeMustExistRule : IBatchRule<PermissionCodeTarget>` | `permission_code_unknown` | jeden `SELECT` po `permission_catalog` — **dziś tego sprawdzenia nie ma w ogóle**, literówka w kodzie zapisuje się do bazy |
| `RoleCodeUniqueRule : IBatchRule<RoleCreateTarget>` | `role_code_duplicate` | wykrywa też duplikaty **wewnątrz wsadu**, nie tylko wobec bazy |
| `RoleGraphCycleRule : IBatchRule<RoleMemberTarget>` | `role_cycle_detected`, `role_self_membership` | patrz §1.3 |

`RoleGraphCycleRule` w całości: jeden `SELECT container_uuid, member_uuid FROM identity.role_member`,
budowa grafu w pamięci, iteracja po celach w kolejności `Ordinal`, symulacja dodania krawędzi,
odrzucenie zamykających cykl. Krawędzie zaakceptowane **wchodzą do symulowanego grafu**, więc
para `A→B` + `B→A` w jednym wsadzie zostaje złapana.

Plus dwa agregatory — `UserBatchValidator`, `RoleBatchValidator`, metoda per operacja masowa.
Z tego samego powodu co w Catalogu: „które reguły obowiązują dla której operacji" to decyzja
przypadku użycia, nie transportu.

### 3.4 Filtry → uuid

- `IUserAccountQueries.GetMatchingUuidsAsync(SearchUserAccountRequest, ct)`
- `IRoleQueries.GetMatchingUuidsAsync(SearchRoleRequest, ct)`

To `SearchAsync` bez stronicowania i sortowania: `AsNoTracking().Select(x => x.Uuid)`.
Wzór: [`ProductQueries.cs`](../../backend/modules/Catalog/Catalog.Infrastructure/Queries/ProductQueries.cs).

---

## 4. Faza 2 — endpointy `user/*`

Pięć endpointów w `Identity.Api/Users/Command/` zamienia `Endpoint<TCommand, Guid>` na
`BatchEndpointBase<TCommand, SearchUserAccountRequest>`.

| Nowa klasa | Trasa | Uprawnienie |
|---|---|---|
| `UserAssignRoleMultipleCommandEndpoint` | `user/batch-assign-role` | `UserManage` |
| `UserRevokeRoleMultipleCommandEndpoint` | `user/batch-revoke-role` | `UserManage` |
| `UserGrantPermissionMultipleCommandEndpoint` | `user/batch-grant-permission` | `UserManage` |
| `UserRevokePermissionMultipleCommandEndpoint` | `user/batch-revoke-permission` | `UserManage` |
| `UserForceLogoutMultipleCommandEndpoint` | `user/batch-force-logout` | `UserManage` |

Każdy: `GetUuidsFromFilterAsync` → `_queries.GetMatchingUuidsAsync(filter, ct)`,
`ValidateTargetsAsync` → odpowiednia metoda `UserBatchValidator`.

Nazwa klasy generuje nazwę metody klienta (`userAssignRoleMultipleCommand`). Trasy **bez**
powtórzonego prefiksu grupy — w przeciwieństwie do zastanego `product/product/batch-set-price`
w Catalogu, gdzie podwojenie utrwalił już wygenerowany klient.

`ForceLogoutUserRequest` (uuid w ścieżce) znika — uuid wchodzi w `TargetUuids`/`TargetFilter`.

W `Program.cs`: pięć rejestracji `AddScoped<IBulkCommandExecutor, BulkCommandExecutor<TCommand>>()`.

**Uwaga do `force-logout`.** Handler woła Keycloak Admin API i `IPermissionProvider.InvalidateAsync`
— to skutki **poza bazą**, których rollback chunka nie cofnie. Odwołanie sesji jest idempotentne,
więc ponowienie jest bezpieczne, ale N wywołań HTTP trzyma transakcję otwartą. Mitygacja:
`"BulkJobs": { "ChunkSize": 50 }` w konfiguracji Identity + komentarz przy handlerze.

---

## 5. Faza 3 — endpointy `role/*`

| Nowa klasa | Trasa | `TFilter` |
|---|---|---|
| `RoleCreateMultipleCommandEndpoint` | `role/batch-create` | `SearchRoleRequest`, `GetUuidsFromFilterAsync` zwraca `[]` |
| `RoleAddPermissionMultipleCommandEndpoint` | `role/batch-add-permission` | `SearchRoleRequest` |
| `RoleRemovePermissionMultipleCommandEndpoint` | `role/batch-remove-permission` | `SearchRoleRequest` |
| `RoleAddMemberMultipleCommandEndpoint` | `role/batch-add-member` | `SearchRoleRequest` |
| `RoleRemoveMemberMultipleCommandEndpoint` | `role/batch-remove-member` | `SearchRoleRequest` |

Wszystkie za `Permissions(P.Identity.RoleManage)`.

Tworzenie ról ma sens wyłącznie w trybie `Commands[]` — agregatu jeszcze nie ma, więc nie ma
czego filtrować. Pusty zwrot z filtra kończy się komunikatem `Brak komend do wykonania`, co jest
poprawnym zachowaniem; udokumentować to w XML-doc endpointu, bo to jedyne odstępstwo od trzech
trybów kontraktu.

`RoleAddMemberCommandHandler` zachowuje wywołanie `IsDescendantAsync` jako drugą linię obrony,
ale komentarz klasy musi powiedzieć wprost, że przypadek **intra-chunk** łapie
`RoleGraphCycleRule`, a nie on.

Pięć kolejnych `IBulkCommandExecutor` w `Program.cs` (razem 10).

---

## 6. Faza 4 — frontend

### 6.1 Regeneracja klienta

```bash
nx run identity-data-access:generate-api
```

Wymaga uruchomionego Identity na porcie 5280 — [`nswag.json`](../../frontend/libs/modules/identity/data-access/nswag.json)
czyta `http://localhost:5280/openapi/v1.json`. Wynik: typy
`BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest` i metody `*MultipleCommand`.

Regenerację robić **raz**, po zamknięciu Faz 2 i 3 — inaczej `identity/feature` przestaje się
kompilować dwa razy zamiast jednego.

### 6.2 Orkiestratory

W [`user.orchestrator.ts`](../../frontend/libs/modules/identity/data-access/src/lib/orchestrators/user/user.orchestrator.ts)
pięć metod opartych o prywatne `_runCommand` zastąpić metodami zwracającymi `Promise<string>`
(jobUuid). Wzór 1:1 z
[`catalog-product.orchestrator.ts`](../../frontend/libs/modules/catalog/data-access/src/lib/orchestrators/product/catalog-product.orchestrator.ts):
`JobMeta` → `uiMetadata: JSON.stringify(meta)` w komendzie → `this.jobService.addJob(jobUuid, queueID, meta)`.
To samo w `role.orchestrator.ts`.

`_runCommand` i ręczne `dataLoader.reloadAsync([uuid])` znikają — odświeżenie robi
`AggregateChanged` na `identity.user`/`identity.role`, które jest już podpięte.

Nowy `IDENTITY_JOB_COMMAND_KEYS` w `@erp/identity/util` (wzór `CATALOG_JOB_COMMAND_KEYS`) —
10 kluczy nazw komend dla dzwonka powiadomień.

### 6.3 Modale

Pięć istniejących kroków (`assign-role`, `grant-permission`, `create-role`, `add-permission`,
`add-member`) przechodzi z `ErpModalStepBase<TCommand>` na
[`ErpBatchStepBase<BatchCommandOf...>`](../../frontend/libs/shared/ui/src/lib/atoms/erp-modal/erp-batch-step.base.ts)
— dostają za darmo rozpoznanie trybu filtra, `targetCount` i blokadę zapisu bez celów. Pola
formularza przepisać z `cmd.roleUuid` na `cmd.templateCommand.roleUuid`.

Dochodzi pięć operacji, które dziś nie mają własnego modalu (`revoke-role`, `revoke-permission`,
`force-logout`, `remove-permission`, `remove-member`) — dla wywoływanych z wiersza tabeli
wystarczy bezpośrednie wywołanie orkiestratora z jednoelementowym `targetUuids`.

Skasować komentarz w `assign-role.step.ts` („bez bazy batchowej — to zwykła, pojedyncza komenda").

### 6.4 Zaznaczanie

`users.store.ts` jest dziś **świadomie** bez `ErpSelectionState` („to nie jest ekran z akcjami
masowymi"). Po migracji jest — przejście na wzorzec z
[`selection-scope.md`](../frontend/selection-scope.md): `ErpSelectionScope`, „Zaznacz wszystko"
jako filtr, próg materializacji, `erp-selection-scope-banner`, `setSelectionCount` /
`setSelectionScope` w toolbarze karmione realnym stanem zamiast `selectedUuid() ? 1 : 0`.
To samo dla `roles.store.ts`.

Panel szczegółów i zakładki (`user-roles-tab`, `role-members-tab`) muszą przejść na „ostatni
zaznaczony" albo zachowanie zależne od zakresu, wzorem `ProductScopeTabStore`.

`identity-row-remove-cell` zaczyna wysyłać jednoelementowe zadanie — wiersz znika po SignalR,
nie natychmiast. Przewidzieć stan „w toku" na wierszu, żeby nie wyglądało na zawieszenie.

### 6.5 Tłumaczenia

Nowe klucze (nazwy komend do dzwonka, etykiety nowych modali, komunikaty kodów błędów
`role_cycle_detected`, `permission_code_unknown`, `role_code_duplicate`, `user_not_found`)
do `translation/pl-PL.json` i `en-US.json`, potem z roota:

```bash
pnpm translate:keys
```

---

## 7. Faza 5 — testy i dokumentacja

- `backend/tests/Identity.Tests` — **dziś nie istnieje** (są tylko `Catalog.Tests`
  i `Erp.ArchitectureTests`). Utworzyć wzorem `Catalog.Tests`, z naciskiem na
  `RoleGraphCycleRule` (para `A→B` + `B→A` w jednym wsadzie musi odrzucić drugi element)
  i `RoleCodeUniqueRule` (duplikat wewnątrz wsadu).
- `Erp.ArchitectureTests` — bez zmian w regułach, ale musi przejść.
- [`identity-authz.md`](./identity-authz.md) §7 — nowa faza „operacje masowe"; usunąć z opisu
  Fazy 2 twierdzenie, że Identity celowo nie ma bulk.
- [`bulk-commands.md`](./bulk-commands.md) §2 — dopisać Identity do modułów wykonujących zadania
  (dziś: „Catalog, Sales — nie Notification").
- [`architecture.md`](./architecture.md#1-stan-wdrożenia) — tabela stanu wdrożenia.
- `CLAUDE.md` — bez zmian; opis operacji masowych jest generyczny.

---

## 8. Weryfikacja end-to-end

Po każdej fazie backendowej:

1. `dotnet build` + `dotnet test` na całym rozwiązaniu — bez regresji wobec 45/45.
2. Realne HTTP z tokenem Keycloaka (tak weryfikowano poprzednie fazy Identity):
   - jednoelementowe `user/batch-assign-role` → `jobUuid`, po ~2 s `job.status = Completed`,
     `grant_audit` ma wpis z prawdziwym `actor_uuid`;
   - wsad 3 użytkowników, z czego jeden nieistniejący → `CompletedWithErrors`, 2 sukcesy
     + 1 `user_not_found` **bez uruchomienia handlera** (pre-check);
   - `role/batch-add-member` z `Commands: [A→B, B→A]` → jeden sukces, jeden `role_cycle_detected`
     — to jest test, dla którego cała reguła grafowa powstała;
   - `role/batch-create` z dwiema rolami o tym samym kodzie → jeden sukces, jeden
     `role_code_duplicate` (nie `persistence_error`, nie trzy ponowienia);
   - tryb filtra: `TargetFilter` po fragmencie e-maila → liczba elementów zadania równa liczbie
     trafień `searchUser`.
3. Frontend: dzwonek pokazuje zadanie z czytelną nazwą komendy, tabela odświeża się bez ręcznego
   reloadu, `job/cancel` na trwającym zadaniu zatrzymuje kolejne chunki.

---

## 9. Ryzyka

| Ryzyko | Charakter |
|---|---|
| Regeneracja NSwag łamie kompilację całego `identity/feature` naraz | Jednorazowy koszt; Fazy 2 i 3 zamknąć backendowo, potem jedna regeneracja i jeden przebieg poprawek |
| Błąd domenowy przestaje być 4xx | Zamierzone. Zamyka to jednak drogę do naprawy długu z [`cqrs.md` §6](./cqrs.md#6-czego-jeszcze-nie-ma) (mapowanie `DomainException` → 422) **dla Identity** — po migracji nie ma ścieżki synchronicznej, na której 422 miałoby sens |
| `RoleGraphCycleRule` materializuje cały graf ról w pamięci | Przy dziesiątkach/setkach ról nieistotne; przy tysiącach do rewizji — dopisać do listy uproszczeń w [`bulk-commands.md`](./bulk-commands.md#3-endpoint--trzy-tryby-jednego-kontraktu) obok wpisu o materializacji filtra |
| Runner zakłada jedną instancję serwisu | Bez zmian — Identity dokłada się do listy z [`architecture.md` §7](./architecture.md#7-założenia-jednoinstancyjne), nie tworzy nowego problemu |
| `force-logout` trzyma transakcję na czas N wywołań HTTP do Keycloaka | Mitygacja: `BulkJobs:ChunkSize = 50` w konfiguracji Identity |

---

## 10. Kolejność wdrażania

```
Faza 0 ──► Faza 1 + Faza 2 ──► Faza 1 + Faza 3 ──► Faza 4 ──► Faza 5
(infra)     (user/*, 1 commit)   (role/*, 1 commit)   (front)   (testy, docs)
```

Fazy 1 i 2 muszą wejść jednym commitem — usunięcie `SaveChanges` bez nowego endpointu zostawia
komendy, które niczego nie zapisują. Tak samo 1 i 3.
