# Dokumentacja — Enterprise Resource Planning

Przepisy zadaniowe i architektura, pisane głównie z myślą o agencie AI wykonującym konkretne zadania w tym repo — dokładne komendy, gotowe do wklejenia szablony kodu, checklisty i uzasadnienie decyzji tam, gdzie łatwo o pomyłkę. [`CLAUDE.md`](../CLAUDE.md) w rootcie zawiera skrót zawsze wczytywany na starcie sesji i tabelę wskazującą, który plik z tego katalogu przeczytać dla danego zadania.

Dokumenty opisują **stan bieżący**, nie historię zmian ani planów — od tego jest `git log`. Jeśli dokument opisuje coś, czego nie ma w kodzie, jest to jawnie oznaczone (legenda znaczników: [`backend/architecture.md` §1](./backend/architecture.md#1-stan-wdrożenia)).

## Frontend — Angular NX, Native Federation

| Temat | Plik |
|---|---|
| Architektura — NX monorepo, Native Federation, 5 warstw modułu, HMR, konwencje | [frontend/architecture.md](./frontend/architecture.md) |
| Nowy moduł — generacja NX, `project.json` hybrydowy, rejestracja w Client, checklist | [frontend/new-module.md](./frontend/new-module.md) |
| Struktura katalogów agregatu w warstwie `feature` | [frontend/feature-structure.md](./frontend/feature-structure.md) |
| Page dla agregatu — `erp-grid-layout`, filtr, zakładki, prawy panel, store strony | [frontend/pages.md](./frontend/pages.md) |
| Smart tabele — lista serwerowa, wiersze z orkiestratora, paginacja i sortowanie | [frontend/smart-tables.md](./frontend/smart-tables.md) |
| Zasięg zaznaczenia — „Zaznacz wszystko" jako filtr, próg materializacji, cele operacji masowych | [frontend/selection-scope.md](./frontend/selection-scope.md) |
| Modale — lazy-loaded, rejestracja przez `ErpModalService` | [frontend/modals.md](./frontend/modals.md) |
| Powiadomienia — toast, dzwonek, historia zadań, `ErpToastService` | [frontend/notifications.md](./frontend/notifications.md) |
| Orkiestratory (`data-access`) — cache, wzbogacanie ViewModeli, dane hierarchiczne | [frontend/orchestrators.md](./frontend/orchestrators.md) |
| Multimedia — wgrywanie, miniaturki, biblioteka mediów i usuwanie zasobów | [frontend/multimedia.md](./frontend/multimedia.md) |
| Atomy UI — wzorzec „Single Config Builder" | [frontend/atoms.md](./frontend/atoms.md) |
| Tłumaczenia (Transloco) — zero-hardcoded-strings, DI shadowing, generator `keys.ts` | [frontend/translations.md](./frontend/translations.md) |
| Komponenty TaigaUI | [`.agents/skills/taiga-ui/SKILL.md`](../.agents/skills/taiga-ui/SKILL.md) |

## Backend — .NET 10, mikroserwisy

| Temat | Plik |
|---|---|
| Architektura — Clean Architecture per moduł, decyzje technologiczne, założenia jednoinstancyjne | [backend/architecture.md](./backend/architecture.md) |
| Nowy mikroserwis — 4 projekty, `.sln`, `DbContext`, `Program.cs` | [backend/new-microservice.md](./backend/new-microservice.md) |
| CQRS — komendy, handlery, zapytania, kontrakt HTTP dla NSwag | [backend/cqrs.md](./backend/cqrs.md) |
| Nazewnictwo komend i endpointów — pięć czasowników, trasy, test architektoniczny | [backend/endpoint-naming.md](./backend/endpoint-naming.md) |
| Operacje masowe — `BatchEndpointBase`, `job`/`job_item`, `BulkCommandRunner` | [backend/bulk-commands.md](./backend/bulk-commands.md) |
| Eksporty i artefakty — `job.kind`, agregat przebiegu, MinIO, `IArtifactStore` | [backend/exports-artifacts.md](./backend/exports-artifacts.md) |
| Magazyn plików — kubełki per moduł, separacja dostępu, sprzątanie osieroconych plików | [backend/media-storage.md](./backend/media-storage.md) |
| Walidacja wsadowa — `IBatchRule`, `ValidationChain`, pre-check | [backend/batch-validation.md](./backend/batch-validation.md) |
| Zdarzenia domenowe i integracyjne, outbox, konsumery RabbitMQ | [backend/events-outbox.md](./backend/events-outbox.md) |
| Realtime SignalR — sygnatury, grupy, koalescencja, resync | [backend/realtime-signalr.md](./backend/realtime-signalr.md) |
| Persystencja — EF Core, migracje, seed, drzewa/closure table | [backend/persistence-ef.md](./backend/persistence-ef.md) |
| Tożsamość i uprawnienia — Keycloak (AuthN) + moduł Identity (AuthZ) | [backend/identity-authz.md](./backend/identity-authz.md) |
