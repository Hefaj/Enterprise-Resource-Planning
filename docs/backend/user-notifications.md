# Powiadomienia użytkownika — skrzynka międzymodułowa

**Stan: 🟡 faza 1 wdrożona w backendzie.** `UserNotificationRequested` jest utrwalany jako
`UserNotification`, ma idempotentny fan-out, prywatny feed i kanał SignalR `notifications`.
Zakładka dzwonka oraz preferencje kanałów pozostają w kolejce. Legenda znaczników —
[`architecture.md`](./architecture.md#1-stan-wdrożenia).
Dziś dzwonek w nagłówku karmi się **wyłącznie** zadaniami masowymi (`NotificationJob` — replika
`job`, kanał `jobs`). Ten dokument opisuje **drugi agregat** w istniejącym mikroserwisie
`Notification`: powiadomienie adresowane do człowieka, pochodzące z dowolnego modułu.

Strona frontowa (druga zakładka dzwonka, skrzynka, ustawienia) →
[`docs/frontend/notifications.md` §10](../frontend/notifications.md#10-skrzynka-powiadomień--druga-zakładka-dzwonka).

---

## 1. Dlaczego to nie jest nowy mikroserwis

`Notification` **już jest** osobnym mikroserwisem: własny schemat, `NotificationDbContext`,
centralny hub SignalR, konsumery `JobAccepted`/`JobProgressed`/`JobCompleted`. Ma tylko jeden
agregat, bo do tej pory jedyną rzeczą, o której warto było powiadamiać, było własne zadanie
masowe.

Wydzielenie „powiadomień o zadaniach" i „powiadomień o wszystkim innym" do dwóch procesów dałoby:
dwa źródła licznika przy **jednym** dzwonku, dwie repliki tożsamości użytkownika, hub w jednym
procesie i feed w drugim. Kryteria wydzielenia z
[`media-storage.md` §1](./media-storage.md#1-biblioteka-nie-mikroserwis) i
[`dms-workflow.md` §12.5](./dms-workflow.md#125-silnik-obiegu-zostaje-w-dms) są tu spełnione przez
serwis, który już stoi.

**Rozstrzygnięte:** powiadomienia użytkownika to agregat `UserNotification` w `Notification`.

---

## 2. Rozstrzygnięcie właściwe: kto ustala odbiorców

To jest jedyna decyzja w tym dokumencie, która ma konsekwencje nieodwracalne, i wymusza ją reguła
architektury, nie preferencja:

> **Zakaz joinów cross-schema.** `Notification` nie może odczytać `taskmgmt.issue_watcher` ani
> `dms.document_acl`. Nie ma więc fizycznej możliwości, żeby sam ustalił, kto obserwuje `DEV-412`.

Stąd podział własności:

| Kto | Za co odpowiada |
|---|---|
| **Moduł źródłowy** | *Komu* to się należy: obserwujący, zgłaszający, wykonawca kroku, zamawiający. Zna swoje subskrypcje i swoją klasę poufności |
| **`Notification`** | *Czy i jak* doręczyć: preferencje użytkownika, grupowanie, stan przeczytania, kanały (dzwonek / e-mail / push), retencja |

Odrzucone warianty:

| Wariant | Dlaczego odpadł |
|---|---|
| Notification subskrybuje zdarzenia domenowe i sam liczy odbiorców | Musiałby znać model subskrypcji każdego modułu — czyli replikować `issue_watcher`, `document_acl` i każdą przyszłą tabelę. Zmiana reguł widoczności w DMS wymuszałaby wdrożenie Notification |
| Każdy moduł ma własną skrzynkę i własny dzwonek | Dzwonek jest jeden. Licznik nieprzeczytanych musiałby się sumować z N serwisów przy każdym otwarciu aplikacji |
| Producent zapisuje wprost do `notification.user_notification` | Zapis cross-schema, czyli ten sam zakaz od drugiej strony. Do tego znosi preferencje i grupowanie |

**Subskrypcje zostają u właściciela danych.** `Notification` nigdy nie jest właścicielem odpowiedzi
na pytanie „kto to obserwuje".

---

## 3. Kontrakt — jedno zdarzenie integracyjne

W `Erp.BuildingBlocks.Contracts`, wersjonowane, **tylko dodawanie pól** — jak każdy kontrakt
integracyjny ([`events-outbox.md`](./events-outbox.md)):

```csharp
public sealed record UserNotificationRequested(
    IReadOnlyList<Guid> Recipients,   // wyliczeni przez producenta
    Guid? ActorId,                    // sprawca — wykluczany z fan-outu
    string Kind,                      // "taskmgmt.issue.commented"
    string SubjectSignature,          // "taskmgmt.issue" — z AggregateSignatures
    Guid SubjectUuid,
    string? SubjectKey,               // "DEV-412", "FV/2024/881" — do wyświetlenia
    string TitleKey,                  // KLUCZ tłumaczenia, nigdy gotowy tekst
    IReadOnlyDictionary<string, string> Params,
    string? GroupKey,
    string Link,                      // trasa frontu, np. "/task-management/issue/DEV-412"
    NotificationSeverity Severity,
    Guid CorrelationId,
    DateTimeOffset OccurredAt);
```

Jedno zdarzenie na wszystkie moduły, nie jedno per rodzaj. Rodzaj jest **daną w polu `Kind`**
([§5](#5-katalog-rodzajów-i-preferencje)), więc nowe powiadomienie w Task Management nie dokłada
typu do kontraktu ani nie wymaga wdrożenia `Notification`.

Cztery pola, które łatwo zrobić źle:

### 3.1 `TitleKey` + `Params`, nigdy gotowy tekst
Język jest **per użytkownik**, a registry Transloco stoi na froncie. Producent renderujący
„Nowy komentarz w DEV-412" zamraża polski w bazie i psuje przełączanie języka. To ta sama zasada,
co przy `job.errorsSummary` ([`notifications.md` §9](../frontend/notifications.md)) i przy
`ErpToastConfig.message`.

Klucze mieszkają w scope'ie **`shared`**, nie w scope'ie modułu-producenta: skrzynkę renderuje
remote `notification`, który nigdy nie ma załadowanego scope'u Catalogu czy DMS-u. Gałąź
`shared.notifications.kinds.*` jest listą znanych rodzajów — dokładnie jak
`shared.errors.codes` jest listą znanych kodów błędów.

### 3.2 `ActorId` osobno
Autor komentarza nie dostaje powiadomienia o własnym komentarzu. Wykluczenie robi się **raz, przy
fan-oucie**, a nie w każdym module z osobna — inaczej pierwszy moduł, który o tym zapomni,
zaleje autora jego własnymi akcjami.

### 3.3 `GroupKey` — bez niego dzwonek jest bezużyteczny
Pięć komentarzy pod jednym zgłoszeniem to **jeden wpis z licznikiem**, nie pięć.
`GroupKey = "taskmgmt.issue:{uuid}:commented"`. Grupowanie ma okno czasowe (`GroupWindow`,
domyślnie 4 h) — po nim powstaje nowy wpis, bo „5 nowych komentarzy" obejmujące trzy dni nie
niesie już informacji.

### 3.4 `SubjectSignature` z `AggregateSignatures`
Nie dowolny string. To pozwala skrzynce grupować po module, filtrować i — docelowo — odświeżać
podgląd tematu, gdy przyjdzie `AggregateChanged` tej samej sygnatury.

---

## 4. Model danych

Schemat `notification`, obok istniejącego `notification_job`.

```
user_notification(uuid pk, user_uuid, kind, severity,
                  subject_signature, subject_uuid, subject_key,
                  title_key, params jsonb,
                  group_key, occurrence_count, last_occurred_at,
                  link, created_at, seen_at, read_at, expire_on)

  index (user_uuid, created_at desc)
  index (user_uuid) where read_at is null          -- licznik nieprzeczytanych
  unique (user_uuid, group_key) where group_key is not null and read_at is null
```

### 4.1 Wiersz per odbiorca, nie zdarzenie + tabela pośrednia
Kuszące jest `notification(1) ↔ notification_recipient(N)`, ale:

- **stan przeczytania jest per użytkownik** — i tak wylądowałby w tabeli pośredniej,
- **feed to najczęstsze zapytanie w systemie** (otwiera się przy każdym logowaniu):
  `where user_uuid = @me order by created_at desc limit 20` schodzi z indeksu, bez joina,
- **grupowanie jest per użytkownik** — jeden użytkownik ma już 4 komentarze w grupie, drugi wchodzi
  z pierwszym; w modelu współdzielonym to się nie da wyrazić.

Fan-out przy zapisie: 200 obserwujących = 200 wierszy. To jest tanie i **ograniczone progiem**
(`MaxRecipientsPerEvent`, domyślnie 500) — powyżej progu wpis powstaje, ale z flagą
`truncated`, a zdarzenie idzie do logu obserwowalności. Powiadomienie rozsyłane do trzech tysięcy
osób jest błędem producenta, nie przypadkiem do obsłużenia.

### 4.2 Konsument jest idempotentny
`unique (user_uuid, group_key) where … read_at is null` robi całą robotę: ponowne dostarczenie
tego samego zdarzenia (RabbitMQ gwarantuje *at-least-once*) trafia w konflikt i zamienia się
w `occurrence_count = occurrence_count + 1` zamiast w duplikat. Dla powiadomień bez `group_key`
kluczem deduplikacji jest `(user_uuid, kind, subject_uuid, correlation_id)`.

To ten sam wzorzec, co idempotencja komend po `X-Request-Id`
([`cqrs.md` §6](./cqrs.md#6-pipeline-komend)) — z indeksu, nie z kodu.

---

## 5. Katalog rodzajów i preferencje

```
notification_kind_catalog(kind pk, module, description_key,
                          default_channels, min_severity, is_obsolete)
notification_preference(user_uuid, kind, channel, enabled)   -- pk złożony
```

`notification_kind_catalog` jest **świadomą kalką `permission_catalog` z Identity**
([`identity-authz.md`](./identity-authz.md)): rodzaj powiadomienia to dana z domyślnymi kanałami,
opisem i znacznikiem wycofania. Dzięki temu:

- dodanie rodzaju „zgłoszenie po terminie" nie wymaga migracji ustawień żadnego użytkownika —
  brak wiersza w `notification_preference` znaczy „domyślne z katalogu";
- strona ustawień renderuje się **z katalogu**, a nie z listy zaszytej w komponencie;
- rodzaj wycofany przestaje się pokazywać w ustawieniach, ale historyczne wpisy nadal się
  renderują.

Nieznany `kind` (producent wyprzedził katalog) **nie jest odrzucany** — powiadomienie powstaje
z kanałem domyślnym `InApp`, a rozjazd ląduje w logu. Odrzucanie oznaczałoby ciche gubienie
powiadomień przy każdym wdrożeniu modułu przed Notification.

---

## 6. Kanały doręczenia

```
notification_delivery(notification_uuid, channel, status, attempts,
                      last_error, delivered_at)   -- pk (notification_uuid, channel)
```

| Kanał | Faza | Uwagi |
|---|---|---|
| `InApp` | 1 | Zapis wiersza + push SignalR. „Doręczone" = zapisane, nie „zobaczone" |
| `Email` | 3 | Przez outbox + worker z retry; szablon i język po stronie Notification |
| `Push` | — | Nie planowane, dopóki nie ma aplikacji mobilnej |

`InApp` nie potrzebuje retry: wiersz w bazie **jest** doręczeniem, a SignalR to tylko
przyspieszenie. Utracony push nadrabia się przy następnym odczycie feedu — dokładnie tak, jak
`JobService` scala stan optymistyczny z repliką serwera.

`Email` jest jedynym miejscem, gdzie tekst **musi** wyrenderować backend. Wtedy potrzebny jest
język użytkownika, którego **nie ma w tokenie** — dojdzie jako pole profilu w Identity
(`GET /internal/users/{id}` rozszerzone o `locale`). Do tego czasu kanał e-mail nie wchodzi, i to
jest właściwa kolejność: wysyłka po angielsku do polskiego użytkownika jest gorsza niż jej brak.

Worker wysyłkowy deklaruje `[ClusterSafe(powód)]` i pobiera zadania przez `FOR UPDATE SKIP LOCKED`
— inaczej dwie instancje wyślą ten sam mail dwa razy
([`multi-instance.md`](./multi-instance.md)).

---

## 7. Realtime

Nowy kanał **`notifications`**, adresowany do grupy `user:{userId}`, celowo **poza konwencją
`{moduł}.{agregat}`** — dokładnie jak istniejący `jobs`. Powód jest ten sam, co opisany
w [`AggregateSignatures.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Contracts/AggregateSignatures.cs):
na kanałach `agg:{signature}` lecą **uuid agregatów do odświeżenia cache'u**, a tu leci
**wiadomość adresowana do konkretnego człowieka**.

Nowa metoda hubu, jako **osobna metoda, nie nowy parametr istniejącej**
([`realtime-signalr.md` §3](./realtime-signalr.md#cztery-metody-serwer--klient)):

```
ReceiveNotification(notificationUuid, unreadCount)
```

Niesie licznik nieprzeczytanych razem z uuid, żeby dzwonek zaktualizował badge bez odpytywania
API. Treść front dociąga leniwie — dopiero gdy użytkownik otworzy popover.

Trzy kanały przy jednym dzwonku, żeby nie pomylić ich w kodzie:

| | `jobs` | `notification.job` | `notifications` |
|---|---|---|---|
| Niesie | trackingID zadania | uuid agregatu `Job` | uuid powiadomienia + licznik |
| Odbiorca | `user:{userId}` | `agg:notification.job` | `user:{userId}` |
| Kto słucha | `JobService` | `BaseOrchestrator` | `NotificationStore` |
| Znaczenie | „Twoje zadanie się skończyło" | „ta encja się zmieniła" | „ktoś zrobił coś, co Cię dotyczy" |

Koalescencja z `RealtimeBroadcaster` **nie obejmuje** tego kanału: powiadomień na użytkownika jest
z natury mało, a opóźnianie ich o okno debounce nic nie daje. Ochroną przed zalewem jest
`GroupKey`, nie okno czasowe.

---

## 8. Poufność — dwa miejsca, gdzie to przecieka

To najpoważniejsze ryzyko tego mechanizmu i musi być rozstrzygnięte przed pierwszą linijką kodu.

### 8.1 Treść powiadomienia wychodzi poza system uprawnień
„Faktura FV/2024/881 od Kowalski sp. z o.o. czeka na akceptację" ląduje w dzwonku, a docelowo
w mailu — poza wszelkimi filtrami widoczności.

Reguły:

1. **`SubjectKey` i `Params` wypełnia producent, świadomie.** Tylko on zna klasę poufności
   dokumentu. Dla klasy poufnej DMS-u wysyła sam fakt („dokument czeka na akceptację") bez tytułu
   i bez kontrahenta — [`dms-workflow.md` §6](./dms-workflow.md#6-dostęp-do-dokumentu).
2. **`Notification` niczego nie dociąga.** Nie woła API modułu źródłowego, żeby „wzbogacić"
   powiadomienie — to obeszłoby decyzję producenta i złamałoby regułę braku agregacji.

### 8.2 Uprawnienie może zniknąć po wysyłce
Odbiorca był uprawniony w chwili wysyłki; za tydzień może nie być. Wpis w skrzynce zostaje.

**`Link` autoryzuje się w chwili kliknięcia** — `403` i strona `/forbidden` są tu poprawnym
zachowaniem, nie błędem. Kasowanie powiadomień przy odebraniu uprawnienia jest odrzucone:
wymagałoby, żeby Notification nasłuchiwał zmian ACL każdego modułu, czyli dokładnie tego, czego
zabrania [§2](#2-rozstrzygnięcie-właściwe-kto-ustala-odbiorców).

Konsekwencja do zaakceptowania i zapisania wprost: **skrzynka jest migawką stanu wiedzy z chwili
zdarzenia**, nie widokiem bieżących uprawnień.

---

## 9. Retencja

`expire_on` ustawiane przy zapisie z klasy rodzaju (domyślnie 90 dni; „zadanie po terminie"
krócej, „dokument oczekuje na akceptację" do rozstrzygnięcia obiegu). Sprzątanie: usługa cykliczna
z dzierżawą na advisory locku, `[ClusterSafe]` — ten sam wzorzec, co `ExpiredGrantCleanupService`
w Identity.

Powiadomienie **nie jest zapisem audytowym**. Kto co zrobił, wie `issue_activity`
([`task-management.md` §11](./task-management.md#11-historia-zmian-i-komentarze)) i `document_audit`
([`dms-workflow.md` §8.1](./dms-workflow.md#81-document_audit)) — u właściciela danych, bez
retencji liczonej w dniach. Traktowanie skrzynki jako dowodu („przecież dostał powiadomienie")
jest błędem: to kanał, nie rejestr.

---

## 10. API

| Endpoint | Uwagi |
|---|---|
| `searchUserNotification` | Feed z paginacją; **zawężony do właściciela** z claimu `sub`, nie z filtru żądania |
| `getUnreadCount` | Sam licznik, do badge'a przy starcie aplikacji |
| `setNotificationRead` / `setAllNotificationsRead` | „Przeczytane"; `seen_at` ustawia się osobno przy otwarciu popovera |
| `getNotificationPreference` / `setNotificationPreference` | Ustawienia per rodzaj i kanał |
| `getNotificationKindCatalog` | Zasila stronę ustawień |

**Bez bramkowania uprawnieniem**, tą samą decyzją co `searchJob`/`getJob`
([`architecture.md` §1](./architecture.md#1-stan-wdrożenia)): to osobisty feed, nie zasób
uprzywilejowany — zagrodzenie go odcięłoby nowego użytkownika od własnych powiadomień. Zawężenie
do `IExecutionContext.UserId` jest **jedynym** i wystarczającym zabezpieczeniem, i musi być
w zapytaniu, nie w filtrze przyjmowanym z żądania.

Nazewnictwo endpointów wg [`endpoint-naming.md`](./endpoint-naming.md); nazwa klasy endpointu jest
kontraktem dla klienta NSwag.

---

## 11. Producenci — co publikuje który moduł

Moduł źródłowy publikuje `UserNotificationRequested` **przez outbox, w tej samej transakcji** co
zmiana, która je wywołała. Nigdy inline, nigdy po `SaveChanges`.

| Moduł | Rodzaj | Odbiorcy wyliczani przez producenta |
|---|---|---|
| Task Management | `taskmgmt.issue.commented` | Obserwujący + przypisany + zgłaszający, minus autor |
| | `taskmgmt.issue.state_changed` | j.w., ograniczone do przejść z kategorii `Done` i powrotów |
| | `taskmgmt.issue.assigned` | Nowy przypisany |
| | `taskmgmt.issue.due_soon` / `overdue` | Przypisany + lead projektu |
| | `taskmgmt.request.delivered` | Zamawiający i obserwujący zlecenia |
| DMS | `dms.document.awaiting_approval` | Wykonawca kroku ([`dms-workflow.md` §4.3](./dms-workflow.md#43-przypisanie-wykonawcy)) |
| | `dms.document.returned` | Autor cofniętego kroku, z powodem cofnięcia |
| | `dms.workitem.escalated` | Przełożony wykonawcy |
| Identity | `identity.grant.expiring` | Właściciel wygasającego nadania + osoba nadająca |
| Catalog | — | Nie publikuje: eksporty to kanał `jobs`, nie powiadomienia |

Ostatni wiersz jest istotny: **zadanie masowe nie staje się powiadomieniem.** Feed zadań ma inny
cykl życia (wygasa z artefaktem), inną akcję („Pobierz") i inną semantykę „przeczytane". Scalenie
ich w jedną tabelę wygląda na uproszczenie, a kończy się kolumnami, które dla połowy wierszy są
puste.

---

## 12. Kolejność wdrożenia

| Faza | Zakres | Co weryfikuje |
|---|---|---|
| 1 | `UserNotification`, `UserNotificationRequested`, konsument z fan-outem i deduplikacją, `searchUserNotification`, kanał `notifications`, druga zakładka dzwonka | **Czy jedno zdarzenie obsłuży wszystkie moduły** |
| 2 | `GroupKey` i koalescencja, `occurrence_count`, strona skrzynki z filtrami | Czy dzwonek jest użyteczny po tygodniu używania |
| 3 | `notification_kind_catalog`, `notification_preference`, strona ustawień | Rodzaj jako dana |
| 4 | Kanał `Email`: `locale` w profilu Identity, szablony, worker z retry `[ClusterSafe]` | Doręczenie poza aplikacją |
| 5 | Retencja, sprzątanie, limity i obserwowalność (rozjazdy `kind`, przekroczenia progu odbiorców) | Higiena długoterminowa |

Faza 1 jest sprawdzalna na jednym rodzaju powiadomienia z Task Management
(`taskmgmt.issue.commented`) — i to wystarczy, żeby wiedzieć, czy kontrakt jest dobry.

---

## 13. Czego tu nie ma

| Kuszące | Dlaczego nie |
|---|---|
| Notification liczy odbiorców | [§2](#2-rozstrzygnięcie-właściwe-kto-ustala-odbiorców) — zakaz joinów cross-schema |
| Skrzynka jako rejestr audytowy | [§9](#9-retencja) — audyt zostaje u właściciela danych |
| Osobny mikroserwis „inbox" | [§1](#1-dlaczego-to-nie-jest-nowy-mikroserwis) |
| Scalenie z feedem zadań | [§11](#11-producenci--co-publikuje-który-moduł) — inny cykl życia i inna semantyka |
| Notification wzbogaca treść, wołając API modułu | [§8.1](#81-treść-powiadomienia-wychodzi-poza-system-uprawnień) — obeszłoby decyzję o poufności; poza tym nie ma agregacji w tej architekturze |
| Powiadomienia „systemowe" (przerwa serwisowa, komunikat admina) | Osobny rodzaj z ręcznym producentem — wchodzi banalnie po fazie 3, ale nie projektujemy pod to teraz |

---

## 14. Zobacz też

- [`realtime-signalr.md`](./realtime-signalr.md) — hub, grupy, kanały `jobs` / `agg:`
- [`events-outbox.md`](./events-outbox.md) — zdarzenia integracyjne, wersjonowanie kontraktów
- [`identity-authz.md`](./identity-authz.md) — `permission_catalog` jako wzorzec dla katalogu rodzajów
- [`task-management.md`](./task-management.md), [`dms-workflow.md`](./dms-workflow.md) — producenci
- [`notifications.md`](../frontend/notifications.md) — toast, dzwonek, skrzynka po stronie frontu
- [`multi-instance.md`](./multi-instance.md) — `[ClusterSafe]`, dzierżawy, `SKIP LOCKED`
