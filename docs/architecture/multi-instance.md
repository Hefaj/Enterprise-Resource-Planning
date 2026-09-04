---
id: architecture.multi-instance
title: Wieloinstancyjność backendu
summary: Reguły bezpiecznej pracy wielu instancji, dzierżawy, role Hub/Relay i Redis backplane.
kind: architecture
scope: backend
audience:
  - backend
  - operations
  - agent
triggers:
  - skalowanie poziome lub druga instancja
  - cluster safe background service
related:
  - architecture.backend
  - architecture.realtime
  - operations.observability
---

# Wieloinstancyjność backendu

Backend ERP zakłada, że każdy mikroserwis może działać w więcej niż jednej instancji. Poprawność
nie może zależeć od blokady, kolejki ani cache istniejącego wyłącznie w pamięci jednego procesu.
Ten dokument opisuje obowiązujący kontrakt. Historyczny plan wdrożenia i dowody poszczególnych zmian
są zachowane w `plans/archive/2026-08-multi-instance.md`.

## Granice odpowiedzialności

- Postgres jest źródłem prawdy dla stanu biznesowego, zadań, dzierżaw i postępu runnerów.
- RabbitMQ i transactional outbox przenoszą zdarzenia integracyjne co najmniej raz; konsumenci muszą
  być idempotentni.
- Redis służy wyłącznie jako backplane SignalR. Nie jest magazynem uprawnień, locków biznesowych ani
  kolejką zadań.
- Pamięć procesu może zawierać cache optymalizacyjny tylko wtedy, gdy utrata lub rozjazd cache nie
  zmienia wyniku biznesowego.

## Runnery i zadania trwałe

Operacje masowe wybierają pracę w krótkiej transakcji przez `FOR UPDATE SKIP LOCKED`. Wybór rekordu,
oznaczenie właściciela i commit następują przed wykonaniem kosztownej pracy. Chunk operacji jest
granicą transakcji, a sukces częściowy jest dozwolony.

Eksporty i raporty używają krótkiego przejęcia z `heartbeat_at`. Właściciel regularnie odnawia
heartbeat, a osierocony przebieg może zostać ponownie przejęty po przekroczeniu jawnego timeoutu.
Artefakt jest publikowany dopiero po kompletnym zapisie w magazynie obiektowym.

Runner nie może polegać na `BackgroundService` uruchomionym dokładnie raz w klastrze. Jeżeli praca
ma być pojedyncza, jej wyłączność musi wynikać z danych lub dzierżawy.

## Praca startowa i cykliczna

Migracje, seedy, reconciliatory i cykliczne cleanupy używają dzierżawy opartej o PostgreSQL advisory
lock. Blokująca dzierżawa jest właściwa dla migracji, ponieważ instancja nie może obsługiwać ruchu na
niezgodnym schemacie. Pozostała praca cykliczna może pominąć turę, gdy dzierżawę ma inny proces.

Każda implementacja `BackgroundService` w kodzie ERP musi mieć atrybut `[ClusterSafe("powód")]`.
Test architektury wymaga uzasadnienia jednego z mechanizmów:

- wybór pracy przez `SKIP LOCKED`;
- dzierżawa Postgresa;
- idempotentne przetwarzanie trwałego rekordu;
- jawna rola procesu, która wyłącza usługę na pozostałych instancjach.

## Uprawnienia i cache

Moduł Identity pozostaje źródłem prawdy autoryzacji. Lokalny cache uprawnień przyspiesza odczyt,
ale nie może rozszerzyć dostępu po wygaśnięciu wpisu. Zmiana uprawnień jest rozgłaszana kanałem
`erp.broadcast`, aby wszystkie instancje szybko unieważniły cache. Brak broadcastu nie może trwale
zepsuć poprawności — TTL i ponowny odczyt są drugą linią obrony.

Wydany token JWT pozostaje ważny do naturalnego wygaśnięcia, o ile przepływ wymuszonego wylogowania
nie unieważni sesji po stronie dostawcy tożsamości.

## Realtime: role Hub i Relay

Tylko Notification wystawia `/hubs/sync`. Ustawienie `Realtime:Role` rozdziela procesy:

- `Hub` przyjmuje połączenia SignalR i używa Redis backplane do dystrybucji wiadomości;
- `Relay` konsumuje zdarzenia agregatów z RabbitMQ, nadaje sekwencję sygnaturze i publikuje do hubów;
- tryb developerski może łączyć role, ale topologia produkcyjna powinna je rozdzielać.

Sekwencja jest trwała i monotoniczna dla sygnatury. Front traktuje lukę w sekwencji jako sygnał do
resynchronizacji przez HTTP. Szczegóły kontraktu opisuje [realtime.md](realtime.md).

## Projektowanie nowej usługi

Przed dodaniem stanu lub workera trzeba odpowiedzieć:

1. Który trwały rekord reprezentuje pracę i jej właściciela?
2. Co się stanie, gdy proces umrze po przejęciu, ale przed zakończeniem?
3. Czy dwie instancje mogą wykonać operację równocześnie i jaki jest skutek?
4. Jak wykrywana i odzyskiwana jest praca osierocona?
5. Jak konsument rozpoznaje duplikat wiadomości?
6. Czy restart usuwa wyłącznie cache, czy także stan potrzebny do poprawności?

Brak odpowiedzi oznacza, że rozwiązanie nie jest gotowe do pracy wieloinstancyjnej.

## Dowody poprawności

Minimalna weryfikacja obejmuje:

- dwie instancje konkurujące o te same zadania bez podwójnego wykonania;
- śmierć właściciela i przejęcie osieroconego zadania po timeoutcie;
- równoległy start migracji i seedów;
- propagację unieważnienia uprawnień do wszystkich instancji;
- dostarczenie realtime przez dowolny hub przy osobnym Relay;
- resynchronizację klienta po luce sekwencji;
- zachowanie jednej instancji identyczne semantycznie z klastrem.

## Zobacz też

- [Architektura backendu](backend.md)
- [Synchronizacja w czasie rzeczywistym](realtime.md)
- [Operacje masowe](../guides/backend/bulk-commands.md)
- [Artefakty i eksporty](../guides/backend/exports-artifacts.md)
- [Obserwowalność](../operations/observability.md)
