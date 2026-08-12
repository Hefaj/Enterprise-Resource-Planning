# Dokumentacja — Enterprise Resource Planning

Dokumentacja techniczna projektu, pisana z myślą o programistach dołączających do zespołu lub wracających do fragmentu kodu po dłuższej przerwie. W przeciwieństwie do `.agents/rules/*.md` (skondensowane instrukcje dla agenta AI), pliki w tym katalogu mają być **czytelne dla człowieka** — z kontekstem, uzasadnieniem decyzji i przykładami z realnego kodu.

## Struktura

- [`frontend/`](./frontend) — dokumentacja Angular/NX (monorepo, mikrofrontendy, wzorce warstwy `data-access` itd.)
- [`backend/`](./backend) — dokumentacja .NET (mikroserwisy) — *backend jest w trakcie budowy, dokumentacja celowo wstrzymana do ustabilizowania architektury*

## Spis treści — frontend

| Temat | Plik |
|---|---|
| Architektura frontendu — NX monorepo, Native Federation, 5 warstw modułu, HMR, konwencje | [frontend/architecture.md](./frontend/architecture.md) |
| Orkiestratory (`data-access`) — tworzenie, cache, wzbogacanie ViewModeli, wzorce dla danych hierarchicznych (drzewa) | [frontend/orchestrators.md](./frontend/orchestrators.md) |

> Dokumentacja jest budowana przyrostowo — kolejne tematy (komponenty UI/atomy, tłumaczenia, tworzenie nowego modułu, backend) będą dodawane w miarę potrzeb.
