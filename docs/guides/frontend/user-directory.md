---
id: frontend.user-directory
title: Użytkownicy w module, który nie jest Identity
summary: Port katalogu użytkowników dla modułów, picker osoby i prezentacja nazwiska zamiast UUID.
kind: guide
scope: frontend
audience:
  - frontend
  - agent
triggers:
  - użytkownik w module innym niż Identity
  - picker osoby lub ERP_USER_DIRECTORY
related: []
---

# Użytkownicy w module, który nie jest Identity

**Stan: ✅ wdrożone.** Katalog działa, korzysta z niego Task Management (przypisany na liście
i na karcie, autor komentarza, aktor w historii, modal seryjnego przypisania). DMS wpina się
w to samo bez własnego kodu.

Ten dokument odpowiada na jedno pytanie: **skąd moduł bierze nazwisko, skoro backend oddaje mu
sam `uuid`, a użytkownicy należą do Identity.**

Model tożsamości, role i uprawnienia → [`identity-authz.md`](../../architecture/security.md).

---

## 1. Problem

Backend każdego modułu zapisuje przy swoich danych **wyłącznie identyfikator osoby** — claim
`sub` z Keycloaka: `issue.assignee_uuid`, `issue_comment.author_uuid`, `issue_activity.actor_uuid`,
a w DMS `document_acl.user_uuid` i akceptujący na czynności. Nazwiska tam nie ma i **nie ma jej
tam być**: kopiowanie nazwy użytkownika do projekcji każdego modułu oznacza, że zmiana nazwiska
w Keycloaku zostawia po sobie kilka nieaktualnych kopii w kilku schematach.

Front musi więc zamienić uuid na nazwisko sam. Trzy rzeczy stają temu na drodze:

- **Granica scope’u NX.** `scope:task-management` może importować wyłącznie `scope:shared`
  i siebie — po `@erp/identity/data-access` nie sięgnie, i słusznie.
- **Granica warstw.** `type:ui` może zależeć tylko od `type:ui` i `type:util`, więc komponent
  w `shared/ui` nie wstrzyknie sobie serwisu HTTP z `shared/data-access`.
- **Skala.** Tabela pięćdziesięciu zgłoszeń pyta o pięćdziesięciu przypisanych naraz.

---

## 2. Rozwiązanie: port w `shared/util`, implementacja w `shared/data-access`

```
@erp/shared/util          ERP_USER_DIRECTORY  (token + interfejs ErpUserDirectory, ErpUserRef)
       ▲                                ▲
       │ type:ui → util                 │ type:data-access → util
@erp/shared/ui                    @erp/shared/data-access
  erp-user-name                     UserDirectoryService  (HTTP + cache + sklejanie paczek)
  erp-user-picker                   provideErpUserDirectory(baseUrl)
  erpUserPickerField()
```

`type:util` jest **jedynym miejscem, które widzą obie strony naraz** — dlatego biblioteka
`shared/util` powstała właśnie tu i po to. Aplikacja (host oraz każdy remote uruchamiany
samodzielnie) woła `provideErpUserDirectory('http://localhost:5280')` i dopiero to spina port
z implementacją.

> **Dlaczego nie po prostu serwis wstrzykiwany wprost w komponencie.** Bo komponent siedzi
> w `type:ui`. Ta sama droga, którą wcześniej poszedł `IDENTITY_PERMISSIONS_API_BASE_URL`
> w `@erp/shared/auth` ([`identity-authz.md` §6](../../architecture/security.md)).

---

## 3. Backend: dwa endpointy katalogowe, osobne od administracyjnych

| Endpoint | Zwraca | Bramka |
|---|---|---|
| `user/searchUserDirectory` | uuidy pasujące do frazy + `totalCount` | samo uwierzytelnienie |
| `user/getUserDirectory` | `{uuid, displayName, email, isActive}` | samo uwierzytelnienie |
| `user/searchUser`, `user/getUser` | to samo **plus nadania ról i uprawnień** | `identity.user.read` |

**Katalog jest za samym tokenem, bez kodu uprawnienia — to decyzja, nie przeoczenie.** To
książka telefoniczna firmy: żeby przypisać komuś zgłoszenie albo wskazać akceptującego, trzeba
go najpierw zobaczyć. Bramka na uprawnieniu dawałaby pusty picker u każdego, kto nie ma jeszcze
nadanej roli — a seed zakłada wyłącznie rolę `administrator`. Wszystko, co administracyjne
(role, uprawnienia, historia nadań, wymuszone wylogowanie), zostaje za `identity.user.read`
i `identity.user.manage`.

**`getUserDirectory` oddaje także konta wyłączone.** Przypisanie sprzed roku i komentarz
z zeszłego kwartału muszą mieć nazwisko również wtedy, gdy ta osoba nie pracuje już w firmie.
Filtr aktywności obowiązuje przy *szukaniu nowej* osoby (`searchUserDirectory`), nie przy
pokazywaniu starego wyboru.

---

## 4. Jak tego użyć

### Nazwisko zamiast uuidu

```html
<erp-user-name [uuid]="issue.assigneeUuid" [empty]="ISSUE_KEYS.table.unassigned | erpTranslate" />
```

`empty` przyjmuje **gotowy tekst**, nie klucz: komponent żyje w `shared/ui` i nie zna scope’u
tłumaczeń modułu, który go renderuje. Dopóki nazwisko nie dojedzie — i na zawsze, gdy katalog
tej osoby nie zna — widać skrócony uuid, nigdy pustkę: puste miejsce znaczyłoby „nieprzypisane”,
czyli zupełnie inną informację.

### Wybór osoby w formularzu

```html
<erp-user-picker [config]="{ label: KEYS.assignee }" [control]="assigneeControl" />
```

### Wybór osoby w modalu operacji masowej

```ts
const directory = inject(ERP_USER_DIRECTORY, { optional: true });
…
.addFormField('assigneeUuid', 'inputPicker', erpUserPickerField(directory), { … })
```

Wzorzec referencyjny: `issue-set-assignee` w Task Management.

### Nazwisko w wierszu tabeli — przez orkiestrator, nie przez komórkę

Kolumna sortowana i filtrowana po stronie serwera nie może brać nazwiska z komponentu komórki.
`TaskManagementIssueOrchestrator` rozwiązuje więc `assignee`/`reporter` w `resolveEagerDependencies`
(jedna paczka uuidów na całą stronę listy) i `_resolveCurrentDeps` (odczyt sygnału, więc wiersz
przerysowuje się sam, gdy nazwisko dojedzie) — dokładnie tak samo, jak rozwiązuje projekt
([`orchestrators.md`](orchestrators.md) §2).

---

## 5. Dlaczego to jest tanie

- **Sklejanie paczek jest istotą, nie optymalizacją.** Zamówienia z jednego cyklu renderowania
  trafiają do wspólnego koszyka i wychodzą jednym `getUserDirectory` — pięćdziesiąt wierszy to
  jedno żądanie, nie pięćdziesiąt.
- **Cache jest wspólny dla całej aplikacji.** Ta sama osoba widziana w Task Management i w DMS
  to jeden wpis; przejście między modułami nie generuje nowych żądań.
- **Braku wpisu nie ponawiamy.** Uuid, którego katalog nie zna, zostaje zapamiętany jako
  „nie ma” — inaczej każde przerysowanie tabeli pytałoby o niego od nowa.
- **Błąd katalogu nie wywraca ekranu.** Zostają uuidy; katalog jest wygodą, nie warunkiem
  działania widoku.

---

## 6. Czego tu nie ma

| Kuszące | Dlaczego nie (dziś) |
|---|---|
| **Replikacja użytkowników do schematu każdego modułu** | Wymaga zdarzenia `UserAccountChanged`, konsumenta i backfillu w każdym module. Kupuje jedną rzecz: sortowanie, filtrowanie i eksport **po nazwisku** po stronie serwera. Do czasu, aż ktoś tego naprawdę zażąda, front sklejający nazwiska wystarcza — a decyzja jest odwracalna, bo kontrakt HTTP się nie zmieni |
| **Awatary** | Keycloak ich nie trzyma; wejdą razem z magazynem plików dla profilu, nie wcześniej |
| **Grupy i jednostki organizacyjne** | Identity, pozycja odłożona ([`identity-authz.md` §9](../../architecture/security.md)). Do tego czasu „dział” to projekt i jego zespół |
| **Podpowiadanie @wzmianek w komentarzach** | Ten sam katalog, ale wymaga integracji z edytorem tiptap — osobna pozycja przy powiadomieniach dla ludzi ([`user-notifications.md`](../../modules/notification/user-notifications.md)) |

---

## 7. Zobacz też

- [`identity-authz.md`](../../architecture/security.md) — skąd bierze się `user_account` i dlaczego Keycloak jest czystym IdP
- [`architecture.md`](../../architecture/frontend.md) — scope’y i warstwy, których ten port nie łamie
- [`orchestrators.md`](orchestrators.md) — rozwiązywanie zależności wiersza
- [`atoms.md`](atoms.md) — wzorzec Single Config Builder, na którym stoi picker
