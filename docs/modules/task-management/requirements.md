---
id: module.task-management.requirements
title: Task Management — kontrakt funkcjonalny
summary: Docelowe wymagania i niezmienniki funkcjonalne modułu Task Management bez harmonogramu wdrożenia.
kind: module-specification
scope: task-management
audience:
  - frontend
  - backend
  - product
  - agent
triggers:
  - wymagania Task Management
  - kryteria akceptacji Issue
related:
  - module.task-management.domain
  - module.task-management.screens
  - architecture.reporting
---

# Task Management — kontrakt funkcjonalny

Dokument jest specyfikacją docelową modułu. Opisuje zachowania i kryteria akceptacji, ale nie ich
harmonogram ani chwilowy procent realizacji. Bieżący zakres UI należy każdorazowo potwierdzić w kodzie
i testach; historia realizacji (fazy 4–8, zamknięta) znajduje się w
`plans/archive/2026-09-task-management-fazy-4-8.md`.

## Cel i granice

Moduł prowadzi pracę wykonywaną w firmie: projekty, zgłoszenia, przepływy stanów, tablice, iteracje,
zlecenia międzydziałowe, czas pracy i raporty. Używa pojęcia `Issue`, aby nie mylić zgłoszenia z
technicznym zadaniem `job` wykonywanym w tle.

Task Management jest właścicielem treści zgłoszeń i ich załączników. Identity pozostaje właścicielem
użytkowników i uprawnień globalnych, a Notification odpowiada za dostarczenie powiadomień i feed
zadań. Dane obce są przejmowane przez kontrakty lub zdarzenia, bez joinów cross-schema.

## Projekty i członkostwo

- Projekt ma stabilny UUID, czytelny klucz, nazwę, rodzaj i jawny stan archiwizacji.
- Klucz zgłoszenia składa się z klucza projektu i rosnącego licznika per projekt, np. `DEV-123`.
- Zmiana klucza projektu nie może po cichu unieważnić istniejących odnośników.
- Członkostwo i rola projektowa sterują widocznością oraz operacjami w obrębie projektu; nie są
  zamiennikiem globalnego kodu uprawnienia.
- Konfiguracja pól, typów, workflow, tablic i ustawień powiadomień jest własnością projektu albo
  jawnie przypisanego schematu wielokrotnego użycia.

## Zgłoszenie

- Issue ma tytuł, opis, typ, stan, autora, opcjonalnego wykonawcę, priorytet i daty audytowe.
- Mutacja agregatu waliduje regułę przed zmianą stanu, aby operacja masowa mogła raportować sukces
  częściowy bez pozostawienia niepoprawnego obiektu.
- Karta jest dostępna pod czytelnym kluczem, a UUID pozostaje identyfikatorem technicznym.
- Opis i komentarze przyjmują ograniczony bezpieczny rich text; sanitizacja odbywa się po stronie
  serwera, a oryginalna treść potrzebna do audytu nie jest zastępowana niesanitowanym HTML-em.
- Historia rejestruje zmianę semantyczną pole po polu, aktora, czas i korelację żądania.

## Widoczność i prywatność

Odczyt Issue wymaga przecięcia uprawnienia globalnego z zakresem projektu. Prywatne zgłoszenie jest
widoczne wyłącznie dla jawnie uprawnionych uczestników oraz ról administracyjnych. Powiązanie z innym
zgłoszeniem nie może samo rozszerzyć dostępu do jego treści.

Lista, karta, tablica, raport i eksport stosują ten sam predykat widoczności. Endpoint agregujący może
ujawnić licznik tylko wtedy, gdy nie pozwala on wnioskować o treści niedostępnych zgłoszeń.

## Typy, pola i workflow

- Typ zgłoszenia jest daną konfiguracyjną, nie enumem zaszytym w kliencie.
- Pola niestandardowe mają stabilne definicje i mapowanie na ograniczoną pulę typowanych slotów;
  profil pól jest wspólnym źródłem dla formularza, tabeli, filtrów i whitelisty sortowania.
- Brak przejścia w opublikowanym workflow oznacza, że zmiana stanu jest niedozwolona.
- Przejście może wymagać pól, uprawnienia albo spełnienia reguły domenowej. UI pobiera wymagania,
  ale backend zawsze weryfikuje je ponownie.
- Publikacja nowej wersji schematu wymaga jawnego mapowania istniejących stanów, jeśli są usuwane lub
  zastępowane.

## Hierarchia, linki i aktywność

- Hierarchia rodzic–dziecko jest jednorodzicielska i nie dopuszcza cykli.
- Pozostałe relacje tworzą graf typowanych linków; reguły kierunku i odwrotnej etykiety są jawne.
- Komentarze wspierają jednopoziomową odpowiedź, edycję z zachowaniem audytu i miękkie usunięcie.
- Załącznik należy do modułu i przechodzi pełny przepływ ticket → upload → rejestracja → dopięcie.
- Aktywność łączy zmiany, komentarze i zdarzenia plikowe w stabilnej kolejności.

## Lista, wyszukiwanie i operacje masowe

- Lista jest serwerowa: paginacja, filtrowanie i sortowanie nie materializują całego zbioru w UI.
- Sortowanie używa whitelisty pól bazowych i skonfigurowanych slotów.
- Filtry widoczne na ekranie mają tę samą semantykę co zakres używany przez „zaznacz wszystko”.
- Operacja masowa korzysta ze wspólnego kontraktu job/job_item, pozwala na sukces częściowy i
  pokazuje wynik per element. Nie uruchamia osobnej kolejki w pamięci procesu.
- Wyszukiwanie po kluczu prowadzi bezpośrednio do karty, o ile użytkownik ma prawo ją odczytać.

## Tablice, backlog i iteracje

- Tablica jest widokiem na Issue, a nie drugim źródłem ich stanu.
- Kolumny mapują opublikowane stany workflow. Niedozwolona kolumna nie tworzy ukrytego stanu.
- Kolejność kart jest zapisana jako `rank`; równoległy drag-and-drop wykrywa konflikt i pozwala
  odświeżyć widok. Rebalans działa w tle i jest bezpieczny w klastrze.
- Backlog i sprint operują na tych samych zgłoszeniach. Zamknięcie sprintu jawnie przenosi elementy
  niezakończone albo pozostawia je zgodnie z wybraną polityką.

## Zlecenia międzydziałowe

Zlecenie jest Issue w projekcie typu `Intake`, powiązanym relacją `realizuje` z pracą wykonawczą.
Postęp wynika ze stanu powiązanej pracy, a odbiór rezultatu jest osobną decyzją człowieka. Widok
zleceń jest przekrojowy, lecz nadal respektuje widoczność treści każdego zgłoszenia.

## Czas, raporty i automatyzacje

- Wpis czasu ma autora, datę, liczbę minut i Issue; korekta pozostawia ślad audytowy.
- Raporty używają `ReportRun` i wspólnej infrastruktury artefaktów, nie długiego żądania HTTP.
- Definicja raportu deklaruje wymagane uprawnienie i izoluje kosztowne Map/Reduce od ścieżki API.
- Reguła automatyzacji jest wersjonowaną daną z ograniczonym katalogiem warunków i akcji. Każde
  wykonanie ma korelację, limit zapętleń i historię rezultatu.

## Powiadomienia

Task Management ustala odbiorców na podstawie znaczenia biznesowego i publikuje
`UserNotificationRequested`; Notification decyduje o kanale, grupowaniu i odczytaniu. Typowe zdarzenia
to przypisanie, wzmianka, komentarz, zmiana stanu, zbliżający się termin i dostarczenie zlecenia.
Preferencja wyciszenia projektu nie może wyciszyć powiadomienia wymagającego działania przez politykę
bezpieczeństwa lub zgodności.

## Kryteria niefunkcjonalne

- wszystkie mutacje przyjmują `X-Request-Id` i są idempotentne w granicach kontraktu komendy;
- odczyty używają projekcji `AsNoTracking` i nie ładują nieograniczonych grafów agregatów;
- pełna historia i załączniki pozostają dostępne zgodnie z retencją po zamknięciu projektu;
- background services deklarują mechanizm bezpieczeństwa klastrowego;
- publiczne ekrany mają pomoc kontekstową lub jawne uzasadnienie wyjątku;
- tekst użytkowy jest dostępny po polsku i angielsku, bez hardcoded stringów w komponentach;
- kluczowe przebiegi są obsługiwalne klawiaturą i mają jawne stany loading, empty oraz error.

## Poza zakresem

Moduł nie zastępuje repozytorium kodu, systemu płacowego, komunikatora ani centralnego DMS. Linki do
tych systemów są referencjami lub integracjami; nie przenoszą ich źródła prawdy do Task Management.

## Zobacz też

- [Model domenowy](domain.md)
- [Podział na ekrany](screens.md)
- [Powiadomienia użytkownika](../notification/user-notifications.md)
- [Raportowanie](../../architecture/reporting.md)
- [Operacje masowe](../../guides/backend/bulk-commands.md)
