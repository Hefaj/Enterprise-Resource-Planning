# Task Management — spójność wizualna

> **Status:** backlog
> **Warunek rozpoczęcia:** stabilny zakres funkcjonalny modułu i zakończona integracja dokumentacji użytkownika.

## Zakres

- spacing i typografia;
- szerokości paneli oraz responsywność;
- rozmieszczenie i hierarchia akcji;
- loading, empty i error states;
- kolory oraz tokeny Taiga UI;
- zachowanie tablicy na wąskich ekranach;
- testy wizualne najważniejszych ekranów i rozmiarów fontu.

Plan nie zmienia modelu domenowego ani nie przenosi komponentów do `shared/ui` bez drugiego realnego konsumenta.

## Zakres już pokryty przez `task-management-ui-refactor.md` — nie duplikować

Etapy 0–10 tamtego planu zamknęły część powyższego zakresu punktowo, przy okazji innej pracy.
Zanim ten plan ruszy, sprawdzić bieżący stan kodu zamiast zakładać braki z tej listy:

- **Loading/empty/error states**: naprawione dla schematu workflow i listy reguł automatyzacji
  (`project-workflow-scheme.component.ts`, `project-automations.component.ts`) — błąd sieci już
  nie udaje pustych danych, jest przycisk „Ponów". Pozostałe ekrany konfiguracji (typy, tagi, SLA,
  webhooki, pola) audytu w tym zakresie NIE miały — to legalny cel tego planu.
- **Responsywność karty zgłoszenia**: prawy panel pól ma już zasuwkę (`fixed`/`translate-x`)
  poniżej `xl`, z przełącznikiem i tłem zamykającym — nie samo przeniesienie pod treść.
  Weryfikacja WIZUALNA na urządzeniach (320 px/tablet/desktop) nie została wykonana — to zostaje
  w zakresie tego planu.
- **Klawiatura na tablicy/backlogu**: strzałki lewo/prawo przenoszą kartę między kolumnami
  (WCAG 2.1.1) — zaimplementowane i częściowo pokryte testami jednostkowymi UI. Testy integracyjne
  feature i pełna weryfikacja klawiaturowa na żywo NIE zostały zrobione — zostają w zakresie.
- **Mobilny wybór kolumny/swimlane tablicy i responsywny backlog** — świadomie NIE zrobione
  (wymaga decyzji projektowej i weryfikacji na urządzeniu) — w całości zostaje w zakresie tego planu.
- **Testy wizualne, kontrast, kolejność tabulacji, QA na 320 px/tablet/desktop** — nie wykonane
  w ogóle (brak przeglądarki z zalogowaną sesją w sesji, która robiła tamten plan) — w całości
  zostaje w zakresie tego planu.
