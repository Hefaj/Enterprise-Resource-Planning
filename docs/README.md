# Dokumentacja — Enterprise Resource Planning

Przepisy zadaniowe i architektura frontendu, pisane głównie z myślą o agencie AI wykonującym konkretne zadania w tym repo — dokładne komendy, gotowe do wklejenia szablony kodu, checklisty i uzasadnienie decyzji tam, gdzie łatwo o pomyłkę. [`CLAUDE.md`](../CLAUDE.md) w rootcie zawiera skrót zawsze wczytywany na starcie sesji i tabelę wskazującą, który plik z tego katalogu przeczytać dla danego zadania.

## Struktura

- [`frontend/`](./frontend) — Angular/NX (monorepo, mikrofrontendy, `data-access`, modale, tłumaczenia, atomy UI)
- [`backend/`](./backend) — .NET (mikroserwisy) — *backend jest w trakcie budowy, dokumentacja celowo wstrzymana do ustabilizowania architektury*

## Spis treści — frontend

| Temat | Plik |
|---|---|
| Architektura frontendu — NX monorepo, Native Federation, 5 warstw modułu, HMR, konwencje | [frontend/architecture.md](./frontend/architecture.md) |
| Orkiestratory (`data-access`) — tworzenie, cache, wzbogacanie ViewModeli, wzorce dla danych hierarchicznych (drzewa), checklist | [frontend/orchestrators.md](./frontend/orchestrators.md) |
| Modale — lazy-loaded, rejestracja przez `ErpModalService`, pełny przepis krok po kroku | [frontend/modals.md](./frontend/modals.md) |
| Tłumaczenia (Transloco) — zero-hardcoded-strings, DI shadowing, generator `keys.ts` | [frontend/translations.md](./frontend/translations.md) |
| Nowy moduł — pełny przepis: generacja NX, architektura hybrydowa Monolit/MFE, rejestracja w Client, checklist | [frontend/new-module.md](./frontend/new-module.md) |
| Atomy UI — wzorzec "Single Config Builder" | [frontend/atoms.md](./frontend/atoms.md) |
| Zasięg zaznaczenia — „Zaznacz wszystko" jako filtr, próg materializacji, cele operacji masowych, panele boczne | [frontend/selection-scope.md](./frontend/selection-scope.md) |

> Backend jest w trakcie budowy — dokumentacja pojawi się, gdy architektura mikroserwisów się ustabilizuje.
