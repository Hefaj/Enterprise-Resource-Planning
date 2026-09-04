---
id: backend.endpoint-naming
title: Nazewnictwo komend i endpointów
summary: Konwencja nazw komend i endpointów oparta na pięciu czasownikach.
kind: guide
scope: backend
audience:
  - backend
  - agent
triggers:
  - nazwanie komendy lub endpointu
  - zmiana kontraktu NSwag
related: []
---

# Nazewnictwo komend i endpointów

Konwencja obowiązuje i jest wymuszana testem architektonicznym.

Wszystkie komendy w systemie spełniają tę konwencję, a `CommandNamingTests`
w `Erp.ArchitectureTests` nie pozwala jej złamać (sekcja 9). Wcześniej czasowników było osiem
(`Set`, `Add`, `Remove`, `Create`, `Assign`, `Grant`, `Revoke`, `ForceLogout`), z czego połowa
opisywała tę samą operację co inny — ujednolicenie do pięciu było **zmianą łamiącą kontrakt
NSwag** (sekcja 8).

---

## 1. Pięć czasowników

Każda komenda zapisu ma w nazwie dokładnie jeden z nich, **bezpośrednio po nazwie agregatu**:

| Czasownik | Znaczenie | Agregat po operacji |
|---|---|---|
| `Create` | założenie nowego agregatu | istnieje, nie istniał wcześniej |
| `Set` | nadpisanie **nazwanego plastra** stanu | istnieje, plaster ma dokładnie wartość z komendy |
| `Add` | dodanie elementu do kolekcji | istnieje, kolekcja o jeden dłuższa |
| `Remove` | usunięcie agregatu albo elementu kolekcji | nie istnieje / kolekcja o jeden krótsza |
| `Exec` | operacja procesowa, której nie da się opisać powyższymi | dowolny |

Nie ma `Update`, `Change`, `Modify`, `Assign`, `Grant`, `Revoke`, `Delete` ani `Patch`. Każdy
z nich to `Set`, `Add` albo `Remove` pod inną nazwą, a synonimy są dokładnie tym, co rozjeżdża
nazewnictwo modułu przez pierwszy rok: `UserAssignRole` i `RoleAddMember` robią **tę samą rzecz**
(dopisanie krawędzi między dwoma agregatami) i nie ma powodu, żeby nazywały się inaczej.

---

## 2. Człon po czasowniku nazywa cel

**Brak członu = sam agregat. Człon = jego część.**

```text
ProductCreateCommand              → tworzy produkt
ProductRemoveCommand              → usuwa produkt
ProductSetPriceCommand            → nadpisuje cenę produktu
ProductAddMultimediaCommand       → dopina multimedium do produktu
ProductRemoveMultimediaCommand    → odpina multimedium od produktu
ProductExecRecalculateStockCommand → operacja procesowa na produkcie
```

Ta jedna reguła rozstrzyga niejednoznaczność, która przy czterech czasownikach zostawała otwarta:
`Remove` bez członu usuwa agregat, `Remove` z członem usuwa element. Nie trzeba dwóch słów.

Człon jest w **liczbie pojedynczej dla jednego elementu, mnogiej dla całej kolekcji**:

```text
ProductAddMultimediaCommand   → dopina jedno
ProductSetMultimediaCommand   → nadpisuje CAŁĄ kolekcję (pusta lista = wyczyszczenie)
```

Dzięki temu nie potrzeba osobnego `Clear` — `Set` z pustą kolekcją jest jego dokładnym
odpowiednikiem i ma tę samą semantykę „to, co przyszło, jest tym, co w bazie".

---

## 3. `Set` nadpisuje plaster, nigdy całego agregatu

To jest reguła, przy której najłatwiej o kosztowną pomyłkę.

`Set` **musi** nazywać plaster, który nadpisuje, i **nie wolno mu** dotykać niczego poza nim.
Bezczłonowe `ProductSetCommand` (nadpisanie całego produktu) jest zakazane. Trzy powody, każdy
wystarczający sam z siebie:

1. **Brak pola w JSON to nie jest „nie zmieniaj".** `BatchEndpointBase` deserializuje `TCommand`
   z ograniczeniem `new()`, więc pole nieprzysłane przez klienta po cichu przyjmuje `default` —
   `0`, `null`, pusta kolekcja. Przy szerokiej komendzie klient, który zapomniał jednego pola,
   nie dostaje błędu, tylko kasuje kolumnę.

2. **Szablon zwielokrotnia tę pomyłkę przez cały filtr.** W trybie `TemplateCommand` + `TargetFilter`
   ([`bulk-commands.md`](bulk-commands.md#2-endpoint--trzy-tryby-jednego-kontraktu)) jeden payload
   idzie na wszystkie cele. Wąskie `SetPrice` powielone na 50 tys. produktów robi dokładnie to,
   czego użytkownik chciał. Szerokie `Set` powielone na 50 tys. produktów nadaje wszystkim te same
   nazwy, opisy i klasyfikacje.

3. **Ostatni wygrywa nad nieświeżym stanem.** Dwóch użytkowników edytujących różne pola tego
   samego agregatu: przy wąskich komendach obie zmiany wchodzą, przy szerokiej jedna znika bez
   śladu. Nie ma dziś optymistycznej blokady na komendach — `xmin` działa wyłącznie wewnątrz
   `BulkCommandRunner`.

Odróżnienie „null" od „nie przysłano" wymagałoby `Optional<T>` albo JSON Patch. Zamrożony kontrakt
NSwag ([`architecture.md` §6](../../architecture/backend.md#6-kontrakt-z-frontendem)) tego praktycznie nie
udźwignie, a wąskie komendy rozwiązują ten sam problem bez żadnej maszynerii.

**`Set` wymaga istniejącego agregatu.** Nie jest upsertem — brak agregatu to
`AggregateNotFoundException`, tak samo jak dziś w każdym handlerze.

---

## 4. `Create` — uuid generuje klient

`Create` jest jedynym czasownikiem, dla którego **tryb filtra i tryb listy identyfikatorów nie
mają zastosowania**: agregat jeszcze nie istnieje, więc nie ma czego wskazać. Sensowny jest
wyłącznie tryb `Commands[]`.

`IAggregateCommand.Uuid` wypełnia **klient**, przed wysłaniem. To nie jest szczegół implementacyjny,
tylko decyzja: ten uuid jest jednocześnie kluczem idempotencji, więc ponowienie tego samego żądania
po zerwaniu połączenia nie tworzy duplikatu — o ile agregat ma unikalny indeks na kluczu naturalnym
(patrz [`batch-validation.md`](batch-validation.md)).

Endpointy `Create` dziedziczą po
[`CreateBatchEndpointBase<TCommand, TFilter>`](../../../backend/building-blocks/Erp.BuildingBlocks.Api/Contracts/CreateBatchEndpointBase.cs),
który **odrzuca** żądanie z `TargetFilter`, `TargetUuids` albo `TemplateCommand` błędem 400.
Wcześniejszy wariant — każdy endpoint zwracający `Enumerable.Empty` z `GetUuidsFromFilterAsync` —
po cichu zakładał zadanie z zerem celów i wyglądał z zewnątrz jak sukces.

---

## 5. `Exec` i jego granica

`Exec` jest **wąską furtką, nie workiem**. Trzy pytania, w tej kolejności; dopiero „nie" na
wszystkie trzy daje `Exec`:

| Pytanie | Jeśli TAK |
|---|---|
| Czy operacja tylko czyta stan i nic nie zmienia? | To jest **zapytanie** (`getX`/`searchX`), nie komenda. |
| Czy operacja produkuje artefakt (plik, dokument, eksport)? | To jest **`Create` na osobnym agregacie przebiegu** — patrz [`exports-artifacts.md`](exports-artifacts.md). |
| Czy da się to opisać jako `Create`/`Set`/`Add`/`Remove` na stanie agregatu? | Użyj tamtego czasownika. |

Zostaje dokładnie to, czym `Exec` ma być: operacja procesowa, po jednym agregacie, bez artefaktu.
`UserExecForceLogoutCommand`, `ProductExecRecalculateStockCommand`.

**`Exec` bywa nieidempotentny i to jest jego jedyna cecha wyróżniająca w kontrakcie.**
`job/retry-failed` ponawia nieudane elementy bez pytania. Ponowienie `SetPrice` jest nieszkodliwe;
ponowienie „wyślij powiadomienie" albo „zarezerwuj numer" już nie. Komenda `Exec`, która nie jest
bezpieczna do ponowienia, **musi** to zaznaczyć: idempotencja z pipeline'u komend
([`cqrs.md` §6](cqrs.md#6-pipeline-komend)) tutaj nie pomaga — chroni przed ponowieniem
ŻĄDANIA HTTP przez klienta, a `retry-failed` ponawia element zadania po stronie serwera,
gdzie żadnego `X-Request-Id` nie ma. Jedynym mechanizmem zostaje świadome wyłączenie takiego
zadania z `retry-failed`.

Druga rzecz, o której łatwo zapomnieć: `Exec`, który nie zmienia żadnej encji, **nie wygeneruje
`AggregateChanged`**, bo to zdarzenie powstaje ze skanu ChangeTrackera
([`events-outbox.md`](../../architecture/integration-events.md)). Frontend nie zobaczy nic poza statusem zadania. To
poprawne, ale trzeba to wiedzieć, projektując informację zwrotną.

---

## 6. Metody agregatu idą za nazwą komendy

```csharp
ProductSetPriceCommand        → product.SetPrice(...)
ProductAddMultimediaCommand   → product.AddMultimedia(...)
ProductRemoveMultimediaCommand → product.RemoveMultimedia(...)
```

Handler zostaje cienki, a czytający kod nie musi tłumaczyć jednego słownika na drugi. Reguła
„metoda agregatu waliduje przed zmianą stanu" ([`cqrs.md` §3](cqrs.md#3-komendy)) obowiązuje
bez zmian — na niej opiera się sukces częściowy operacji masowych.

---

## 7. Nazwa endpointu i trasa

Klasa endpointu: `{Agregat}{Czasownik}{Cel}MultipleCommandEndpoint`, w folderze
`{Modul}.Api/{Agregaty}/Command/`.

Trasa: **`batch-{czasownik}-{cel}` w kebab-case, bez powtarzania nazwy grupy.**

```csharp
public override void Configure()
{
    Post("batch-set-price");   // NIE "product/batch-set-price"
    Group<ProductGroup>();     // prefiks "product" dokłada grupa
}
```

> **Skąd ta reguła.** Catalog i Sales przez jakiś czas powtarzały nazwę grupy w trasie, przez co
> wygenerowany klient wywoływał `/product/product/batch-set-price`. Kompiluje się, działa i nic
> tego nie łapało poza czytaniem wygenerowanego klienta — stąd osobny test
> `Trasa_nie_powtarza_nazwy_grupy` (sekcja 9).

---

## 8. Co dokładnie łamie przemianowanie

Obie nazwy są częścią zamrożonego kontraktu
([`architecture.md` §6](../../architecture/backend.md#6-kontrakt-z-frontendem)):

| Zmiana w C# | Skutek na froncie |
|---|---|
| nazwa klasy komendy | zmienia się nazwa typu `BatchCommandOf{Komenda}And{Filtr}`, importowanego wprost przez orkiestrator |
| nazwa klasy endpointu | zmienia się nazwa metody klienta (`UseErpApi` obcina sufiks `Endpoint`) |
| trasa | zmienia się URL w wygenerowanym kliencie |

Kolejność przy migracji: przemianuj w C# → zregeneruj klienta NSwagiem → popraw importy
w orkiestratorach → dopiero wtedy commit. Rozjazd między tymi krokami kompiluje się po stronie
backendu i wywala dopiero w przeglądarce.

---

## 9. Reguła jest wymuszona testem, nie dobrą wolą

Konwencja nazewnicza bez testu zgnije przy pierwszej komendzie pisanej pod presją czasu — to ten
sam argument, dla którego granic warstw pilnuje `Erp.ArchitectureTests`, a nie code review.
[`CommandNamingTests`](../../../backend/tests/Erp.ArchitectureTests/CommandNamingTests.cs) sprawdza
cztery rzeczy:

| Test | Co pilnuje |
|---|---|
| `Komenda_uzywa_jednego_z_pieciu_czasownikow` | nazwa pasuje do `^[A-Z][A-Za-z]*?(Create\|Set\|Add\|Remove\|Exec)[A-Za-z]*Command$` |
| `Prefiks_komendy_zgadza_sie_z_agregatem` | prefiks nazwy odpowiada agregatowi z namespace'u (`Sales.Application.Customers` → `Customer…`) |
| `Komenda_i_endpoint_maja_zgodne_nazwy` | dla każdej komendy istnieje `{Stem}MultipleCommandEndpoint` |
| `Trasa_nie_powtarza_nazwy_grupy` | `Post("batch-…")` nie zaczyna się od prefiksu swojej `Group<>` |

Skanowane są wyłącznie zestawy modułów — fundament i sam projekt testowy są pominięte, bo ten
drugi celowo zawiera typy wzorcowe (`SamplePlainCommand`) sprawdzające skaner rejestracji, a nie
nazewnictwo. Ostatni test idzie po źródłach, a nie po refleksji: trasę ustawia `Configure()`,
którego wywołanie wymagałoby zbudowania endpointu razem z całym jego DI.

Nowy czasownik dodaje się **przez zmianę tego testu**, świadomie — nie przez napisanie komendy,
która akurat przechodzi.

---

## 10. Zobacz też

- [CQRS](cqrs.md) — struktura komendy, handlera i zapytania
- [Operacje masowe](bulk-commands.md) — trzy tryby wskazywania celów, `job`/`job_item`
- [Eksporty i artefakty](exports-artifacts.md) — dlaczego artefakt to `Create` na agregacie przebiegu
- [Walidacja wsadowa](batch-validation.md) — pre-check przed założeniem zadania
