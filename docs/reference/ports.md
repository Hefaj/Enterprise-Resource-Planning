---
id: reference.ports
title: Mapa portów deweloperskich
summary: Przydział portów aplikacji frontendowych i mikroserwisów w środowisku lokalnym.
kind: reference
scope: repository
audience: [frontend, backend, operations]
triggers: [port aplikacji lub mikroserwisu, konflikt portów w środowisku lokalnym]
related: [frontend.new-module, backend.new-microservice]
---

# Mapa portów deweloperskich

## Frontend

| Aplikacja | Port |
|---|---:|
| client | 4200 |
| catalog | 4201 |
| inventory | 4202 |
| sales | 4203 |
| dms | 4204 |
| task-management | 4205 |
| notification | 4206 |
| identity | 4207 |

Nowy moduł otrzymuje następny wolny port.

## Backend HTTP

| Mikroserwis | Port |
|---|---:|
| Catalog | 5149 |
| Notification | 5250 |
| Sales | 5269 |
| Identity | 5280 |
| Task Management | 5290 |

Inventory i DMS nie mają jeszcze mikroserwisów ani zarezerwowanych portów HTTP.
