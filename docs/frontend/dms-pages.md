# DMS — podział na strony

**Stan: 📐 projekt, brak kodu.** Front DMS to dziś atrapa (`MOCK_DOCUMENTS` w
`libs/modules/dms/feature`), a `entry.menu.ts` zawiera pozycje-zaślepki do usunięcia.

Model domenowy, silnik obiegu, sloty sortowalne i kontrakt listy →
[`docs/backend/dms-workflow.md`](../backend/dms-workflow.md).
Ten dokument opisuje **wyłącznie podział na strony i nawigację**.

Wzorce, na których stoją te strony: [`pages.md`](./pages.md),
[`smart-tables.md`](./smart-tables.md), [`feature-structure.md`](./feature-structure.md),
[`modals.md`](./modals.md).

---

## 1. Zasada podziału

Strony dzielimy **po roli, która na nie wchodzi**, nie po encji. Operator, administrator obiegów
i kontroler zadają zupełnie inne pytania tym samym danym — i to jest realna granica ekranów.

Dwie reguły, które przesądzają o kształcie menu:

- **Typ dokumentu to kontekst jednej listy, nie osobna strona.** Faktury, umowy i CV mieszkają na
  tym samym ekranie, przełączane kontekstem typu ([`dms-workflow.md` §10.2](../backend/dms-workflow.md#102-typ-dokumentu-jako-kontekst-tabeli)).
  Osobna strona per typ oznacza N kopii tego samego kodu i menu rosnące z każdym nowym typem.
- **„Moje czynności” to zakres, nie strona.** Ten sam `searchDocument` z parametrem `scope`
  ([`dms-workflow.md` §10.1](../backend/dms-workflow.md#101-zakres-jako-przełącznik-nie-filtr)).

Obecne `entry.menu.ts` łamie obie (`document/invoices`, `document/contracts`) — idzie do kosza
w fazie 0.

---

## 2. Grupa A — praca codzienna (operator)

### 2.1 Dokumenty — `/dms/document`
Główna strona modułu. Standardowy `erp-grid-layout` + filtr + smart tabela + action toolbar
([`pages.md`](./pages.md)). Dwa przełączniki nad tabelą:

- **zakres**: `Moje czynności` / `Wszystkie dostępne` / `Obserwowane`,
- **typ dokumentu**: zmienia zestaw kolumn i resetuje sortowanie.

W zakresie `Moje czynności` **wiersz to `WorkItem`, nie `Document`** — jeden dokument może mieć
dwie moje czynności, dedup zgubiłby jedną. Orkiestrator trzyma wiersze po UUID, więc musi
rozróżniać, czyje to UUID-y w danym zakresie.

Definicja kolumn pochodzi z `getDocumentTypeProfile`, nie ze stałej w komponencie
([`dms-workflow.md` §10.3](../backend/dms-workflow.md#103-skąd-front-wie-jakie-są-kolumny)).

### 2.2 Karta dokumentu — `/dms/document/:uuid`
**Osobna strona, nie prawy panel przy tabeli.** Powód jest praktyczny: podgląd pliku musi
dominować ekran — nikt nie napisze opisu merytorycznego, nie widząc faktury.

Layout dwukolumnowy: viewer PDF po lewej (szerszy), po prawej panel czynności — formularz kroku
**budowany w runtime z `config` węzła** ([`dms-workflow.md` §9.4](../backend/dms-workflow.md#94-formularze-z-definicji))
— oraz zakładki: metadane, historia obiegu, załączniki, komentarze, dostęp.

To jedyna strona modułu, gdzie prawy panel jest ważniejszy od listy.

### 2.3 Skrzynka wejściowa (triage) — `/dms/inbox`
**Inna encja niż dokument**: wiersz to `document_inbox`, który może jeszcze nie mieć `Document`
(KSeF przysłał coś, czego reguła routingu nie dopasowała, albo metadanych nie dało się
wyekstrahować) — [`dms-workflow.md` §7](../backend/dms-workflow.md#7-wejście-dokumentów).

Akcje: przypisz typ, uzupełnij metadane, odrzuć jako duplikat, ponów przetworzenie.

Bez tej strony automatyczny ingest jest czarną skrzynką — pierwsza nietypowa faktura znika
bez śladu.

---

## 3. Grupa B — konfiguracja (administrator obiegów)

### 3.1 Szablony obiegów — `/dms/workflow-template`
Lista szablonów z wersjami (`Draft`/`Published`/`Deprecated`) i licznikiem instancji działających
na każdej wersji — bez tego nikt nie odważy się oznaczyć wersji jako `Deprecated`.

### 3.2 Edytor szablonu — `/dms/workflow-template/:uuid/:version`
Pełnoekranowy canvas. **Jedyna strona w systemie, która świadomie łamie wzorzec
`erp-grid-layout` + filtr + tabela** — zapisane tutaj, żeby przy review nie wyglądało na
niedbalstwo.

Własne wyzwania: walidacja grafu na żywo, panel właściwości węzła (formularz generowany ze schematu
`config` handlera), podgląd ścieżki („którędy pójdzie faktura na 8000 zł”).

Biblioteka do rysowania grafu — **decyzja odłożona do fazy 2** (własny SVG vs zewnętrzna
zależność). TaigaUI tego nie pokrywa.

### 3.3 Typy dokumentów — `/dms/document-type`
Master-detail: lista typów + edytor pól. Pola, **mapowanie na sloty**, domyślny szablon obiegu,
klasa retencji, klasa poufności.

Tu żyje ostrzeżenie „slot już użyty, mapowania nie zmienisz” —
[`dms-workflow.md` §3.2](../backend/dms-workflow.md#32-sortowalne-atrybuty--sloty-typowane).

### 3.4 Reguły routingu wejścia — `/dms/intake-rule`
Uporządkowana lista: warunek → szablon obiegu. **Kolejność ma znaczenie**, więc zmiana kolejności
przez drag&drop, nie przez sortowanie kolumny.

Wart dołożenia tester: wklej przykładowe metadane, pokaż dopasowaną regułę. Bez niego reguły
pisze się na ślepo.

### 3.5 Źródła dokumentów — `/dms/source`
KSeF i kolejne konektory: stan połączenia, ostatnie pobranie, licznik błędów, ręczne wymuszenie.
Mała strona, ale jedyne miejsce, w którym widać, że ingest stoi od trzech dni.

---

## 4. Grupa C — nadzór (kontroler, audytor)

### 4.1 Instancje obiegów — `/dms/workflow-instance`
Widok **procesowy, nie dokumentowy** — inne pytania niż lista dokumentów: gdzie utknęło, ile po
terminie, kto blokuje, co wisi najdłużej.

Akcje administracyjne: skok (`dms.workflow.jump`), anulowanie, wznowienie po `Hold`, przepięcie
wykonawcy.

### 4.2 Audyt — `/dms/audit`
Append-only, filtr po dokumencie / użytkowniku / akcji / dacie, eksport.

To **nie duplikat** zakładki „historia” z karty dokumentu: karta odpowiada na „co się działo
z tą fakturą”, ta strona na „co robił ten użytkownik w marcu”.

Rejestr dostępu (kto miał wgląd i z jakiego tytułu — [`dms-workflow.md` §6.2](../backend/dms-workflow.md#62-materializowany-document_acl))
wchodzi jako druga zakładka; wydzielić w osobną stronę dopiero gdy urośnie.

### 4.3 Archiwum — `/dms/archive`
Read-only: dokumenty zarchiwizowane, terminy retencji, co wygasa w tym roku, pobranie zamrożonej
metryki ([`dms-workflow.md` §8.2](../backend/dms-workflow.md#82-metryka-dokumentu)).

Osobno od listy roboczej — mieszanie żywych i zarchiwizowanych zaśmieca codzienną pracę i psuje
domyślne filtry.

---

## 5. Grupa D — zastępstwa

### 5.1 Zastępstwa — `/dms/delegation`
Moje zastępstwa + widok administratora. Mała strona, ale bez niej urlop jednej księgowej
zatrzymuje wszystkie faktury, a ktoś ratuje sytuację `workflow.jump`-em — czyli obchodząc proces.

---

## 6. Czego świadomie NIE robimy osobną stroną

| Kuszące | Dlaczego nie |
|---|---|
| „Moje zadania” | Zakres na liście dokumentów. Osobna strona zmusza użytkownika do zgadywania, gdzie patrzeć |
| „Faktury” / „Umowy” / „CV” w menu | Kontekst typu na jednej liście — inaczej N kopii tego samego ekranu |
| „Uprawnienia i role DMS” | To Identity ([`identity-authz.md`](../backend/identity-authz.md)). W DMS zostaje wyłącznie ACL per dokument (zakładka na karcie) i zakres organizacyjny |
| Dashboard analityczny | Robi się go pierwszy i przez pół roku świeci pustkami. Po fazie 5, gdy są dane |

---

## 7. Struktura katalogów i modale

Agregaty w `libs/modules/dms/feature/src/lib/`, każdy wg [`feature-structure.md`](./feature-structure.md)
(`components`/`modal`/`page`/`translation`):

```
document/  document-type/  workflow-template/  workflow-instance/
intake/    audit/          delegation/
```

Modale ([`modals.md`](./modals.md)): start obiegu (wybór szablonu), cofnięcie (**obowiązkowy
powód**), przekazanie/delegacja, udostępnienie dokumentu, odrzucenie, podsumowanie masowej
akceptacji, wgranie nowej wersji pliku.

Sygnatury SignalR do orkiestratorów: `dms.document`, `dms.workflowInstance`, `dms.workItem`
([`orchestrators.md`](./orchestrators.md)).

---

## 8. Menu i uprawnienia

Każda pozycja `entry.menu.ts` dostaje `requiredPermission` — strony z grup B i C muszą być
niewidoczne dla operatora. Obecna atrapa nie ma żadnego (dla porównania: menu Catalogu ma je
na każdej pozycji).

Proponowany układ menu:

```
Dokumenty                    → /dms/document
Skrzynka wejściowa           → /dms/inbox
Nadzór
  ├ Instancje obiegów        → /dms/workflow-instance
  ├ Audyt                    → /dms/audit
  └ Archiwum                 → /dms/archive
Konfiguracja
  ├ Szablony obiegów         → /dms/workflow-template
  ├ Typy dokumentów          → /dms/document-type
  ├ Reguły wejścia           → /dms/intake-rule
  └ Źródła dokumentów        → /dms/source
Zastępstwa                   → /dms/delegation
```

Karta dokumentu (`/dms/document/:uuid`) nie ma pozycji w menu — wchodzi się na nią z listy.

---

## 9. Kolejność względem faz wdrożenia

Fazy → [`dms-workflow.md` §11](../backend/dms-workflow.md#11-kolejność-wdrożenia).

| Faza | Strony |
|---|---|
| 0 | Dokumenty, Karta dokumentu (bez panelu czynności), Typy dokumentów |
| 1 | Karta dokumentu — panel czynności; zakres „Moje czynności” |
| 2 | Szablony obiegów, Edytor szablonu |
| 4 | Instancje obiegów |
| 5 | Archiwum |
| 6 | Skrzynka wejściowa, Reguły wejścia, Źródła dokumentów |
| 7 | Zastępstwa, Audyt |

Faza 0–1 to **trzy strony, nie dwanaście**.
