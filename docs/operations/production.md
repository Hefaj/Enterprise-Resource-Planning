---
id: operations.production
title: Runbook wdrożenia produkcyjnego
summary: Powtarzalny runbook pakowania, konfiguracji, migracji, wdrożenia, backupu i rollbacku ERP.
kind: operations
scope: operations
audience:
  - operations
  - backend
  - frontend
  - agent
triggers:
  - wdrożenie produkcyjne
  - gateway TLS backup lub migracje wdrożeniowe
related:
  - operations.observability
  - architecture.backend
  - architecture.multi-instance
---

# Runbook wdrożenia produkcyjnego

Ten dokument definiuje powtarzalny kontrakt wydania ERP. Repozytorium nie zawiera jeszcze pełnego
łańcucha produkcyjnego; konkretne prace umożliwiające pierwsze wdrożenie są śledzone w
`plans/backlog/production.md`. Runbook pozostaje obowiązujący dla każdego środowiska produkcyjnego,
niezależnie od dostawcy infrastruktury.

## Artefakty wydania

Wydanie składa się z niemutowalnych, wersjonowanych obrazów:

- osobny obraz dla każdego API .NET;
- osobny obraz hosta Angular i każdego remota Native Federation;
- jawna wersja manifestu federacji zgodna z wersjami remotów;
- identyfikator commita i numer wydania zapisany jako metadane obrazu.

Obraz nie zawiera sekretów ani konfiguracji środowiska. Ta sama suma obrazu przechodzi przez
środowiska; zmieniają się wyłącznie wartości dostarczane przy uruchomieniu.

## Konfiguracja i sekrety

Sekrety trafiają z menedżera sekretów do procesu lub montowanego pliku i nigdy nie są commitowane.
Dotyczy to co najmniej haseł Postgresa, RabbitMQ i Keycloak, kluczy MinIO, certyfikatów oraz danych
klientów integracyjnych.

Każdy moduł ma własny `API_BASE_URL`; Notification dodatkowo publikuje adres huba. W produkcji
przeglądarka widzi jeden origin wystawiony przez gateway. Konfiguracja CORS jest ograniczona do
znanych originów i pozostaje zgodna z `AllowCredentials`.

## Gateway i TLS

Gateway kończy TLS i routuje:

- host oraz statyczne zasoby remotów;
- ścieżki API modułów;
- połączenie WebSocket/long polling do `/hubs/sync`;
- publiczne endpointy Keycloak wymagane przez przeglądarkę.

Nagłówki `Forwarded`/`X-Forwarded-*` są zaufane wyłącznie od gatewaya. Issuer tokenu Keycloak,
redirect URI klienta oraz publiczny hostname muszą opisywać ten sam publiczny adres.

## Migracje i dane startowe

Migracje są osobnym, obserwowalnym krokiem wdrożenia, a nie efektem ubocznym przyjęcia pierwszego
żądania HTTP. Dzierżawa Postgresa gwarantuje pojedynczego wykonawcę. Aplikacja nie otrzymuje ruchu,
dopóki migracje wszystkich wymaganych schematów nie zakończą się powodzeniem.

Seed i reconciliation muszą być idempotentne. Nie usuwają danych użytkownika tylko dlatego, że wpis
zniknął ze statycznego katalogu. Zmiany destrukcyjne wymagają planu migracji danych i sprawdzonego
rollbacku aplikacyjnego.

## Kolejność powtarzalnego wdrożenia

1. Zbuduj, przeskanuj i podpisz obrazy oraz wygeneruj manifest wersji.
2. Wykonaj backup danych objętych zmianą i potwierdź możliwość odtworzenia.
3. Uruchom migracje z pojedynczą dzierżawą; przerwij wydanie po błędzie.
4. Wdróż backend bez kierowania ruchu i poczekaj na `live` oraz `ready`.
5. Wykonaj smoke test API, outboxu, RabbitMQ, MinIO i Identity.
6. Opublikuj remoty, następnie zgodny manifest federacji i host.
7. Stopniowo skieruj ruch, obserwując błędy, latencję, zaległości i restarty.
8. Zapisz wynik wdrożenia wraz z wersjami artefaktów i migracji.

## Health checks i obserwacja

- `live` odpowiada tylko, czy proces działa;
- `ready` odpowiada, czy instancja może przyjąć ruch;
- `deps` diagnozuje zależności i nie musi być używany jako agresywny probe orkiestratora.

Alerty podczas wdrożenia obejmują odsetek błędów, p95/p99, zaległość outboxu i zadań, heartbeat
runnerów, odłączenia SignalR oraz błędy uwierzytelnienia. Pełny katalog jest w
[observability.md](observability.md).

## Rollback

Rollback aplikacji polega na ponownym skierowaniu ruchu do poprzednich, zachowanych obrazów.
Migracje muszą być rozszerzające i kompatybilne wstecz w oknie rollout/rollback. Usunięcie kolumny,
zmiana znaczenia pola lub nieodwracalna transformacja danych wymaga osobnego, wieloetapowego wydania.

Po rollbacku sprawdź kolejki, outbox, stan zadań i kompatybilność manifestu Native Federation.
Nie przywracaj automatycznie całej bazy, jeśli można bezpiecznie cofnąć sam kod.

## Backup i odtwarzanie

Backup obejmuje Postgresa, konfigurację Keycloak oraz obiekty trwałe w MinIO. Retencja i szyfrowanie
są jawne, a test odtworzenia odbywa się cyklicznie na odizolowanym środowisku. RPO i RTO ustala
właściciel biznesowy; samo wykonanie kopii bez próby restore nie jest dowodem gotowości.

## Checklista wydania

- [ ] obrazy mają niezmienny tag lub digest i pochodzą z zaakceptowanego commita;
- [ ] sekrety nie występują w obrazie, logach ani repozytorium;
- [ ] backup i procedura odtworzenia są aktualne;
- [ ] migracje przeszły przed dopuszczeniem ruchu;
- [ ] `live`, `ready` i smoke testy są zielone;
- [ ] issuer, gateway, TLS, CORS i redirect URI są spójne;
- [ ] manifest federacji wskazuje zgodne wersje remotów;
- [ ] alerty i dashboard wydania są aktywne;
- [ ] znany jest właściciel decyzji o rollbacku;
- [ ] wynik i wersje wydania zostały zapisane.

## Zobacz też

- [Architektura backendu](../architecture/backend.md)
- [Wieloinstancyjność](../architecture/multi-instance.md)
- [Obserwowalność](observability.md)
- [Artefakty i pliki](../guides/backend/exports-artifacts.md)
