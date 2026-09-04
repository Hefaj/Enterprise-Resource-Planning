---
id: reference.repository-map
title: Mapa repozytorium
summary: Najważniejsze katalogi monorepo i odpowiedzialność przechowywanych w nich artefaktów.
kind: reference
scope: repository
audience: [agent, contributor]
triggers: [gdzie umieścić plik w repozytorium, mapa katalogów monorepo]
related: [architecture.system-overview]
---

# Mapa repozytorium

| Katalog | Odpowiedzialność |
|---|---|
| `frontend/apps/client` | host Angular i kompozycja remotów |
| `frontend/apps/modules/*` | aplikacje remote Native Federation |
| `frontend/libs/client/*` | warstwy hosta |
| `frontend/libs/modules/*` | warstwy modułów biznesowych |
| `frontend/libs/shared/*` | współdzielone kontrakty, UI i infrastruktura frontendu |
| `backend/modules/*` | mikroserwisy biznesowe w Clean Architecture |
| `backend/building-blocks/*` | współdzielone kontrakty i mechanizmy backendu |
| `backend/tests/*` | testy modułowe i architektoniczne |
| `docs/*` | trwała dokumentacja techniczna |
| `plans/*` | jednorazowe plany realizacji |
| `tools/scripts/*` | deterministyczne generatory i narzędzia repozytorium |
