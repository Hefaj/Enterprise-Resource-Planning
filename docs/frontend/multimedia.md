# Multimedia produktu — wgrywanie i wyświetlanie

Ścieżka pliku od okna wyboru w przeglądarce do miniaturki w galerii. Strona backendowa —
[`docs/backend/exports-artifacts.md` §9](../backend/exports-artifacts.md#9-zawartość-wgrywana-przez-użytkownika--drugi-kubełek-druga-droga).

**Stan: ✅ w kodzie** — wgrywanie, rejestracja w katalogu, dopięcie do produktów i **zdejmowanie
multimediów z produktów** ([§5](#5-zdejmowanie-multimediów-z-produktów)) działają end-to-end;
miniaturki są podpięte do wariantu `thumb`. Nie ma jeszcze **po stronie frontu**: UI usuwania
zasobów z samej biblioteki mediów (backend ma pod nie `multimedia/batch-remove`) i podglądu
pełnoekranowego (wariant `preview`), więc brakuje tam wyłącznie ekranów. Klient NSwag czeka
na regenerację — nowe pola czytane są tymczasowo przez sygnaturę indeksową DTO, a metody
`productRemoveMultimediaMultipleCommand` / `productSetMultimediaMultipleCommand` są w
`api-client.ts` dopisane ręcznie w kształcie, który wygeneruje NSwag.

---

## 1. Trzy żądania, nie jedno

```text
1. getMultimediaUploadTickets   → N adresów PUT, po jednym na plik (celują w poczekalnię)
2. PUT <adres magazynu>         ← bajty NIE przechodzą przez nasze API ani przez HttpClient
3. multimedia/create            → wpisy w katalogu; zwraca uuidy SYNCHRONICZNIE
4. product/batch-add-multimedia → dopięcie do produktów; zwykłe zadanie masowe
```

Kroki 1–3 wykonuje `CatalogMultimediaOrchestrator.uploadFiles()`, krok 4 —
`CatalogProductOrchestrator.addMultimediaMultiple()`. Podział jest celowy: plików są dziesiątki
i użytkownik czeka na nie w modalu, produktów mogą być tysiące i te idą przez zadanie z paskiem
postępu.

> **Krok 2 świadomie omija `HttpClient`.** Adres jest podpisem magazynu, nie żądaniem do naszego
> serwisu, a `erpClientIdInterceptor` dokłada do wszystkiego nagłówek `X-Client-Id`, którego MinIO
> nie ma na białej liście CORS — preflight odbiłby transfer. `fetch` nie przechodzi przez
> interceptory Angulara, więc problem znika u źródła, bez dokładania wyjątków do interceptora
> współdzielonego przez wszystkie moduły.

---

## 2. Pliki wgrywają się przy wyborze, nie przy zapisie

`ProductAddMultimediaStepComponent` startuje transfer natychmiast po wybraniu plików. Zapis modalu
wysyła już tylko komendę z gotowymi uuidami i wraca od razu, tak samo jak każda inna operacja
masowa.

| | Wgrywanie przy wyborze (jest) | Wgrywanie przy zapisie (odrzucone) |
|---|---|---|
| Co widzi użytkownik | postęp tam, gdzie patrzy | modal zawieszony na „Zapisz" |
| Ile trwa zapis | tyle, co zlecenie zadania | tyle, co łącze użytkownika |
| Anulowanie modalu | zostawia plik w poczekalni magazynu (sprząta go lifecycle) | nie zostawia nic |

Cena jest realna, ale **front nie musi z nią nic robić**. Zamknięcie modalu po wgraniu, a przed
zapisem, zostawia obiekt w poczekalni magazynu (`staging/`), którą reguła lifecycle sprząta po
dobie. Nie ma i nie będzie żadnego „posprzątaj po mnie" wysyłanego przy zamykaniu modalu — takie
wywołanie i tak by nie doszło, gdy użytkownik zamyka kartę
([`media-storage.md` §4a](../backend/media-storage.md#4a-obiekt-wgrany-po-którym-nie-przyszła-komenda)).

> Zasoby, które **zostały** zarejestrowane, a nie trafiły do żadnego produktu, nie są sierotami
> tylko dlatego, że nikt ich nie używa — to pozycje biblioteki mediów i usuwa je użytkownik
> ([§4c](../backend/media-storage.md#4c-zasób-któremu-zniknęła-ostatnia-referencja)). Backend
> ma na to `multimedia/batch-remove`; zasób używany przez produkt odpada z błędem
> `multimedia_still_referenced`, a `MultimediaDto.referenceCount` pozwala pokazać to, zanim
> użytkownik kliknie. **Wymaga regeneracji klienta NSwag** — obie rzeczy są nowe.

---

## 3. Miniaturki: `blob:`, nie adres endpointu

Zawartość wydaje `GET multimedia/content/{uuid}`, za sprawdzeniem uprawnienia. **`<img src>` nie
dokłada nagłówka `Authorization`**, więc wstawienie tego adresu wprost dałoby 401 przy każdej
miniaturce. Dlatego plik pobiera `CatalogMultimediaContentService` przez `HttpClient` (interceptor
dokłada token), a do `src` trafia dopiero `blob:`-URL.

`MultimediaThumbnailCellComponent` wybiera źródło w trzech krokach:

1. `thumbnailUrl` — gotowa miniaturka zewnętrzna (kolumna dotyczy zasobów spoza systemu),
2. `originalUrl` — zasób leży poza systemem, adres jest publiczny,
3. wariant `thumb` z magazynu — **tylko gdy `hasDerivatives`**.

> **Punkt 3 nigdy nie spada na oryginał.** Miniaturki generuje backend asynchronicznie, po
> zatwierdzeniu transakcji rejestrującej (`docs/backend/media-storage.md` §8); dopóki nie są
> gotowe, `hasDerivatives` jest `false` i komórka pokazuje ikonę typu. W praktyce trwa to
> ułamek sekundy — pomiary z przebiegu kontrolnego: 0,25 s dla zdjęcia 12 Mpx, 1,6 s dla 90 Mpx,
> czyli szybciej, niż użytkownik zamknie modal. Zaślepka jest więc ścieżką dla plików wielkich
> i dla przypadku, w którym konsument akurat zalega — nie normalnym etapem, który zawsze mignie.
> Pobranie oryginału „żeby coś było" to ~6 MB na zdjęcie 4K
> w kwadracie 40×40 — a `blob:`-cache trzymałby 300 takich plików w pamięci karty. Gotowość
> przychodzi zwykłym `AggregateChanged` na `catalog.multimedia`, więc miniaturka pojawia się sama,
> bez odpytywania w pętli.

Nieobrazy i pliki powyżej progu dekodowania nie dostają wariantów w ogóle — zostają przy ikonie
typu pliku.

> **Dlaczego nie presigned URL, skoro eksporty go używają.** Presigned żyje minuty i jest
> bearer-owy. Dla pliku pobieranego raz, po kliknięciu, to zaleta. Dla galerii — wada podwójna:
> adres wygasa w trakcie przeglądania listy, a każda miniaturka wymaga wcześniejszej wymiany
> identyfikatora na link. Porównanie obu dróg: [backend §9](../backend/exports-artifacts.md).

`blob:`-URL-e trzymają dane w pamięci karty aż do `revokeObjectURL`, więc serwis zwalnia najstarsze
po przekroczeniu `MAX_CACHED_OBJECT_URLS` (300 zasobów).

---

## 4. Cele operacji to zasięg zaznaczenia, nie wiersze panelu

Akcja „Dodaj multimedia masowo" w toolbarze zakładki składa cele przez
`ProductScopeTabStore.batchTargets()` — tak samo jak każda inna akcja masowa
([`selection-scope.md`](./selection-scope.md)). Przy zaznaczeniu opisanym filtrem panel pokazuje
próbkę kilku produktów, a operacja obejmuje **wszystkie** pasujące; komenda niesie wtedy
`targetFilter`, a nie listę identyfikatorów.

Lista plików jedzie w `templateCommand.multimediaUuids`, bo ta sama paczka ma trafić do każdego
celu — uuid produktu dokłada backend przy materializacji szablonu.

---

## 5. Zdejmowanie multimediów z produktów

Panel ma dwie akcje usuwania i **żadna z nich nie kasuje pliku**. Zasób jest osobnym agregatem
i pozycją biblioteki mediów; zdjęcie go z produktu to odpięcie referencji, nie usunięcie danych
([`media-storage.md` §4c](../backend/media-storage.md#4c-zasób-któremu-zniknęła-ostatnia-referencja)).
Plik znika sam tylko wtedy, gdy jest `Owned` — wtedy zabiera go kaskada, w tej samej transakcji.
Zdanie potwierdzenia mówi to użytkownikowi wprost, zanim kliknie.

| Akcja toolbara | Komenda | Cele |
|---|---|---|
| „Usuń zaznaczone" (grupa `selection-actions`) | `product/batch-remove-multimedia` | jawna lista komend, po jednej na produkt |
| „Usuń wszystkie multimedia" (grupa `mass-actions`) | `product/batch-set-multimedia` z pustą listą | zasięg zaznaczenia (`batchTargets()`) |

**Dlaczego masowe zdejmowanie idzie podmianą galerii, a nie listą plików.** Przy zaznaczeniu
opisanym filtrem panel widzi próbkę kilku produktów, więc list plików pozostałych celów po prostu
nie zna — zebranie ich oznaczałoby pobranie galerii wszystkich pasujących produktów tylko po to,
żeby odesłać je z powrotem. `SetMultimedia` z pustą listą adresuje **stan docelowy**, nie
zawartość: jest idempotentne i niezależne od tego, co front zdążył wczytać.

**Dlaczego zdejmowanie zaznaczonych idzie listą komend, a nie szablonem.** Wiersz panelu to para
(produkt, plik). Ten sam plik wisiący pod dwoma produktami daje dwa wiersze i użytkownik może
zaznaczyć tylko jeden z nich — każdy produkt zdejmuje więc własny podzbiór, czego szablon
(jedna komenda na wszystkie cele) nie wyraża. Akcja jest przy tym bramkowana zasięgiem `explicit`
(`setScopes(['explicit'])`), więc lista zaznaczonych wierszy jest kompletna, a nie próbką.

Obie akcje wracają natychmiast — to zwykłe zadania masowe z paskiem postępu, oznaczone
`queueId = 'catalog-product-multimedia-tab'`, żeby powiadomienia z panelu grupowały się razem.

---

## 6. Zobacz też

- [Modale](./modals.md) — rejestracja `PRODUCT_ADD_MULTIMEDIA_MODAL_ID` i cykl życia kroku
- [Zasięg zaznaczenia](./selection-scope.md) — skąd biorą się cele operacji masowej
- [Orkiestratory](./orchestrators.md) — gdzie mieszkają komendy i cache zasobów
- [Eksporty i artefakty §9](../backend/exports-artifacts.md) — bilety, endpoint zawartości
- [Magazyn plików](../backend/media-storage.md) — kubełki, separacja dostępu, cykl życia pliku, miniaturki (§8)
