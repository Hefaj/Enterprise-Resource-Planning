# Użytkownicy w module, który nie jest Identity

**Stan: ✅ katalog wdrożony; 🔄 UI do migracji.** Port, cache i użycie w Task Management
działają. Domenowe wrappery UI w `shared/ui` są stanem przejściowym — docelowa kompozycja
poniżej zostawia tam tylko generyczne atomy.

Ten dokument odpowiada na jedno pytanie: **skąd moduł bierze nazwisko, skoro backend oddaje mu
sam `uuid`, a użytkownicy należą do Identity.**

Model tożsamości, role i uprawnienia → [`identity-authz.md`](../backend/identity-authz.md).

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
                                       ▲
                                       │ type:data-access → util
@erp/shared/data-access           UserDirectoryService  (HTTP + cache + sklejanie paczek)
                                  provideErpUserDirectory(baseUrl)
                                       │ token DI
                                       ▼
moduł konsumenta / feature         config dla generycznego `erp-input-picker`
```

`type:util` jest **jedynym miejscem, które widzą obie strony naraz** — dlatego biblioteka
`shared/util` powstała właśnie tu i po to. Aplikacja (host oraz każdy remote uruchamiany
samodzielnie) woła `provideErpUserDirectory('http://localhost:5280')` i dopiero to spina port
z implementacją.

`shared/ui` pozostaje generyczne: nie ma w nim domenowego `erp-user-picker` ani wstrzyknięcia `ERP_USER_DIRECTORY`. Smart component w `feature` modułu, który jest właścicielem formularza, wstrzykuje port i przekazuje konfigurację do `erp-input-picker`. Dzięki temu wzorzec da się powtórzyć dla języków bez rozrastania `shared/ui` o komponenty poszczególnych domen.

> **Dlaczego nie po prostu serwis Identity wstrzykiwany wprost.** Moduły nie mogą importować `@erp/identity/data-access`, a `shared/data-access` nie może zależeć od Identity. Port w `shared/util` to publiczny, kierunkowy kontrakt; implementacja HTTP zostaje po stronie wspólnej infrastruktury.

---

## 3. Backend: dwa endpointy katalogowe, osobne od administracyjnych

| Endpoint                          | Zwraca                                   | Bramka                |
| --------------------------------- | ---------------------------------------- | --------------------- |
| `user/searchUserDirectory`        | uuidy pasujące do frazy + `totalCount`   | samo uwierzytelnienie |
| `user/getUserDirectory`           | `{uuid, displayName, email, isActive}`   | samo uwierzytelnienie |
| `user/searchUser`, `user/getUser` | to samo **plus nadania ról i uprawnień** | `identity.user.read`  |

**Katalog jest za samym tokenem, bez kodu uprawnienia — to decyzja, nie przeoczenie.** To
książka telefoniczna firmy: żeby przypisać komuś zgłoszenie albo wskazać akceptującego, trzeba
go najpierw zobaczyć. Bramka na uprawnieniu dawałaby pusty picker u każdego, kto nie ma jeszcze
nadanej roli — a seed zakłada wyłącznie rolę `administrator`. Wszystko, co administracyjne
(role, uprawnienia, historia nadań, wymuszone wylogowanie), zostaje za `identity.user.read`
i `identity.user.manage`.

**`getUserDirectory` oddaje także konta wyłączone.** Przypisanie sprzed roku i komentarz
z zeszłego kwartału muszą mieć nazwisko również wtedy, gdy ta osoba nie pracuje już w firmie.
Filtr aktywności obowiązuje przy _szukaniu nowej_ osoby (`searchUserDirectory`), nie przy
pokazywaniu starego wyboru.

---

## 4. Jak tego użyć

### Nazwisko zamiast uuidu

Smart component `feature` pobiera pozycję z `ERP_USER_DIRECTORY` i renderuje jej
`displayName` we własnym scope’ie. W tabeli właściwym miejscem jest nadal orkiestrator, który
rozwiązuje paczkę UUID-ów dla całej strony. Dopóki nazwisko nie dojedzie — i na zawsze, gdy
katalog tej osoby nie zna — pokazujemy skrócony UUID, nigdy pustkę: puste miejsce znaczyłoby
„nieprzypisane”, czyli zupełnie inną informację.

Obecny `erp-user-name`, który sam wstrzykuje katalog, jest wrapperem przejściowym do usunięcia
razem z `erp-user-picker`; nie kopiuj go przy tworzeniu kolejnego katalogu.

### Wybór osoby w formularzu

```html
<erp-input-picker
  [config]="assigneePickerConfig()"
  [control]="assigneeControl"
/>
```

`assigneePickerConfig()` żyje w `feature` danego modułu. Wstrzykuje `ERP_USER_DIRECTORY`, ustawia `valueKey: 'uuid'`, `labelKey: 'displayName'`, obsługuje wyszukiwanie i dociąga wybrane UUID-y. Etykieta pochodzi z tłumaczeń modułu konsumenta. To jest celowy wzorzec docelowy; obecny wrapper `erp-user-picker` należy podczas refaktoru usunąć z `shared/ui`.

### Wybór osoby w modalu operacji masowej

```ts
const directory = inject(ERP_USER_DIRECTORY, { optional: true });
…
.addFormField('assigneeUuid', 'inputPicker', configureAssigneePicker(directory), { … })
```

`configureAssigneePicker` żyje w `feature` modala, nie w `shared/ui`; ustawia na generycznym
builderze `erp-input-picker` wyszukiwanie oraz rozwiązywanie UUID-ów przez port. Obecny
`erpUserPickerField` jest analogicznym wrapperem przejściowym do migracji.

### Nazwisko w wierszu tabeli — przez orkiestrator, nie przez komórkę

Kolumna sortowana i filtrowana po stronie serwera nie może brać nazwiska z komponentu komórki.
`TaskManagementIssueOrchestrator` rozwiązuje więc `assignee`/`reporter` w `resolveEagerDependencies`
(jedna paczka uuidów na całą stronę listy) i `_resolveCurrentDeps` (odczyt sygnału, więc wiersz
przerysowuje się sam, gdy nazwisko dojedzie) — dokładnie tak samo, jak rozwiązuje projekt
([`orchestrators.md`](./orchestrators.md) §2).

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

| Kuszące                                                | Dlaczego nie (dziś)                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Replikacja użytkowników do schematu każdego modułu** | Wymaga zdarzenia `UserAccountChanged`, konsumenta i backfillu w każdym module. Kupuje jedną rzecz: sortowanie, filtrowanie i eksport **po nazwisku** po stronie serwera. Do czasu, aż ktoś tego naprawdę zażąda, front sklejający nazwiska wystarcza — a decyzja jest odwracalna, bo kontrakt HTTP się nie zmieni |
| **Awatary**                                            | Keycloak ich nie trzyma; wejdą razem z magazynem plików dla profilu, nie wcześniej                                                                                                                                                                                                                                |
| **Grupy i jednostki organizacyjne**                    | Identity, pozycja odłożona ([`identity-authz.md` §9](../backend/identity-authz.md)). Do tego czasu „dział” to projekt i jego zespół                                                                                                                                                                               |
| **Podpowiadanie @wzmianek w komentarzach**             | Ten sam katalog, ale wymaga integracji z edytorem tiptap — osobna pozycja przy powiadomieniach dla ludzi ([`user-notifications.md`](../backend/user-notifications.md))                                                                                                                                            |

---

## 7. Zobacz też

- [`identity-authz.md`](../backend/identity-authz.md) — skąd bierze się `user_account` i dlaczego Keycloak jest czystym IdP
- [`architecture.md`](./architecture.md) — scope’y i warstwy, których ten port nie łamie
- [`orchestrators.md`](./orchestrators.md) — rozwiązywanie zależności wiersza
- [`atoms.md`](./atoms.md) — wzorzec Single Config Builder, na którym stoi picker
- [`cross-module-composition.md`](./cross-module-composition.md) — kiedy stosować token, widżet, modal albo generyczny atom oraz jak dodać następny katalog
