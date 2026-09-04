---
id: module.catalog.architecture
title: Architektura modułu Catalog
summary: Techniczny indeks domeny produktów, multimediów, gwarancji i raportów modułu Catalog.
kind: module-specification
scope: catalog
audience: [frontend, backend, agent]
triggers: [zmiana w module Catalog, produkt multimedia gwarancja lub raport Catalogu]
related: [frontend.multimedia, backend.media-storage, architecture.reporting]
---

# Architektura modułu Catalog

Catalog jest modułem referencyjnym dla list serwerowych, operacji masowych, multimediów i raportów.
Frontend znajduje się w `frontend/apps/modules/catalog` oraz `frontend/libs/modules/catalog`, a
mikroserwis w `backend/modules/Catalog`.

## Odpowiedzialność domenowa

Moduł jest właścicielem produktów, ich klasyfikacji, cen, gwarancji oraz zasobów multimedialnych.
Jest także właścicielem technicznego przebiegu raportów z Catalogu i referencji do ich artefaktów.

## Granice danych

Dane Catalogu znajdują się w jego schemacie Postgresa. Pliki trafiają do kubełków należących do
modułu przez wspólną abstrakcję artefaktów; rekord domenowy i referencja do pliku pozostają w granicy
tej samej transakcji biznesowej.

## Frontend

Publiczne ekrany obejmują listę produktów oraz bibliotekę multimediów. Smart components korzystają
z orkiestratorów w `data-access`, a prezentacja pozostaje w warstwie `ui`. Zasady implementacyjne
opisują [smart tabele](../../guides/frontend/smart-tables.md) i
[multimedia](../../guides/frontend/multimedia.md).
