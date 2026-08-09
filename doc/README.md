# Dokumentacja — Enterprise Resource Planning

Dokumentacja techniczna projektu, pisana z myślą o programistach dołączających do zespołu lub wracających do fragmentu kodu po dłuższej przerwie. W przeciwieństwie do `.agents/rules/*.md` (skondensowane instrukcje dla agenta AI), pliki w tym katalogu mają być **czytelne dla człowieka** — z kontekstem, uzasadnieniem decyzji i przykładami z realnego kodu.

## Struktura

- [`frontend/`](./frontend) — dokumentacja Angular/NX (monorepo, mikrofrontendy, wzorce warstwy `data-access` itd.)
- [`backend/`](./backend) — dokumentacja .NET (mikroserwisy) — *do uzupełnienia*

## Spis treści — frontend

| Temat | Plik |
|---|---|
| Orkiestratory (`data-access`) — tworzenie, cache, wzbogacanie ViewModeli o powiązane dane | [frontend/orchestrators.md](./frontend/orchestrators.md) |

> Dokumentacja jest budowana przyrostowo — kolejne tematy (architektura modułów, komponenty UI, tłumaczenia, backend) będą dodawane w miarę potrzeb.
