---
id: architecture.system-overview
title: Przegląd systemu ERP
summary: Granice systemu, odpowiedzialności modułów i przepływ danych między frontendem a mikroserwisami.
kind: overview
scope: system
audience: [architecture, agent]
triggers: [przegląd architektury całego systemu, ustalenie granicy między modułami]
related: [architecture.frontend, architecture.backend]
---

# Przegląd systemu ERP

System jest monorepo łączącym frontend Angular NX z mikroserwisami .NET. Każdy moduł biznesowy
utrzymuje własną domenę, API i dane, a host Angular składa interfejs z remotów Native Federation.

## Frontend

Host `client` odpowiada za shell, uwierzytelnienie i ładowanie modułów. Moduły mają pięć warstw:
`contract`, `feature`, `ui`, `data-access` oraz `util`. Szczegóły opisuje
[architektura frontendu](./frontend.md).

## Backend

Mikroserwisy używają Clean Architecture i osobnych schematów Postgresa. Komunikacja między modułami
odbywa się przez wersjonowane zdarzenia integracyjne, bez joinów między schematami. Szczegóły opisuje
[architektura backendu](./backend.md).

## Przepływ zmian

Mutacja trafia do API właściciela agregatu, przechodzi przez pipeline komendy i transakcję, a zmiana
agregatu jest publikowana przez outbox. Notification przekłada zdarzenia na centralny kanał realtime,
z którego korzystają orkiestratory frontendu.
