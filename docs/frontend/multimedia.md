# Multimedia produktu — wgrywanie i wyświetlanie

Ścieżka pliku od okna wyboru w przeglądarce do miniaturki w galerii. Strona backendowa —
[`docs/backend/exports-artifacts.md` §9](../backend/exports-artifacts.md#9-zawartość-wgrywana-przez-użytkownika--drugi-kubełek-druga-droga).

**Stan: ✅ w kodzie** — wgrywanie, rejestracja w katalogu i dopięcie do produktów działają
end-to-end. Nie ma jeszcze: generowania miniatur, usuwania zasobów, podglądu pełnoekranowego
i sprzątania plików wgranych do modalu zamkniętego bez zapisu.

---

## 1. Trzy żądania, nie jedno

```text
1. getMultimediaUploadTickets   → N adresów PUT, po jednym na plik
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
| Anulowanie modalu | zostawia zasoby-sieroty | nie zostawia nic |

Cena jest realna: zamknięcie modalu po wgraniu, ale przed zapisem, zostawia zasoby nieprzypisane
do żadnego produktu (i obiekty w magazynie). Sprzątanie takich sierot nie jest zaimplementowane —
indeks po `artifact_uuid` w tabeli `multimedia` jest pod nie założony.

---

## 3. Miniaturki: `blob:`, nie adres endpointu

Zawartość wydaje `GET multimedia/content/{uuid}`, za sprawdzeniem uprawnienia. **`<img src>` nie
dokłada nagłówka `Authorization`**, więc wstawienie tego adresu wprost dałoby 401 przy każdej
miniaturce. Dlatego plik pobiera `CatalogMultimediaContentService` przez `HttpClient` (interceptor
dokłada token), a do `src` trafia dopiero `blob:`-URL.

`MultimediaThumbnailCellComponent` wybiera źródło w trzech krokach:

1. `thumbnailUrl` — gotowa miniaturka (kolumna istnieje, nikt jej dziś nie produkuje),
2. `originalUrl` — zasób leży poza systemem, adres jest publiczny,
3. zawartość z magazynu przez serwis — **tylko dla `mediaType === 'image'`**.

Ograniczenie w punkcie 3 jest istotne: bez niego wideo o wadze 300 MB pobierałoby się w całości,
żeby narysować kwadrat 40×40. Nieobrazy dostają ikonę typu pliku.

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

## 5. Zobacz też

- [Modale](./modals.md) — rejestracja `PRODUCT_ADD_MULTIMEDIA_MODAL_ID` i cykl życia kroku
- [Zasięg zaznaczenia](./selection-scope.md) — skąd biorą się cele operacji masowej
- [Orkiestratory](./orchestrators.md) — gdzie mieszkają komendy i cache zasobów
- [Eksporty i artefakty §9](../backend/exports-artifacts.md) — kubełki, bilety, endpoint zawartości
