# Komponenty i dane między modułami

Ten dokument odpowiada na pytanie, **jaki byt tworzyć**, gdy moduł A ma udostępnić coś modułowi B. Chroni to `shared/ui` przed staniem się zbiorem kontrolek należących do wszystkich domen, a jednocześnie nie zmusza modułów do wzajemnych importów.

Nie powstaje z tego szósta warstwa modułu ani nowy tag NX `type:reference-data`. „Dane referencyjne” to nazwa kategorii, która korzysta z istniejących warstw `shared/util` i `shared/data-access`.

---

## 1. Wybór mechanizmu

| Potrzeba                                                                                        | Tworzymy                          | Przykład                                           |
| ----------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| Gotowy, samodzielny fragment UI innego modułu ma być osadzony w **jednym, znanym slocie hosta** | **widżet remota** w `contract`    | lista zadań pod dzwonkiem (`JobListComponent`)     |
| Użytkownik uruchamia odrębny przepływ należący do innego modułu                                 | **modal remota** w `contract`     | modal edycji agregatu                              |
| Moduł buduje własną stronę, filtr lub formularz, lecz potrzebuje danych/capability innej domeny | **port + token DI**               | katalog użytkowników lub języków                   |
| Różne moduły potrzebują tylko wspólnego sposobu renderowania i interakcji                       | **generyczny atom** w `shared/ui` | `erp-input-picker`, `erp-table`, `erp-tree-picker` |

**Widżet dostarcza UI, token dostarcza dane lub capability. Nie są zamiennikami.** Widżet może wewnętrznie używać tokenów, ale token nie przenosi cudzej warstwy `feature` do modułu konsumenta.

### Kiedy nie tworzyć widżetu

Nie twórz widżetu dla pola formularza lub filtra osadzanego w dowolnych stronach modułów. Taki komponent musiałby przez granicę runtime przenosić `FormControl`/`ControlValueAccessor`, walidację, reset stanu, tłumaczenia, uprawnienia i obsługę remota uruchomionego samodzielnie. Byłby to ukryty system pluginów formularzy, słabiej typowany i bardziej złożony niż zwykła kompozycja Angulara.

Rejestr widżetów istnieje wyłącznie dla layoutu hosta. Remote’y biznesowe nie używają go do wkładania kontrolek w swoje własne szablony.

---

## 2. Katalog referencyjny z innego modułu

Przykłady: użytkownicy z Identity, języki z przyszłego modułu Languages, waluty, jednostki miary. Właściciel danych pozostaje modułem źródłowym; pozostałe moduły dostają wyłącznie mały kontrakt odczytowy.

```
moduł źródłowy (właściciel)              shared
┌───────────────────────────┐   ┌────────────────────────────────────┐
│ endpoint katalogowy       │   │ util:  port + InjectionToken + typy │
│ search…Directory          │──▶│ data-access: HTTP, cache, batching  │
│ get…Directory             │   └─────────────────┬──────────────────┘
└───────────────────────────┘                     │ token DI
                                                    ▼
                                      feature modułu konsumenta
                                      ┌──────────────────────────────┐
                                      │ składa config swojego filtra  │
                                      │ i przekazuje go do generic UI │
                                      └──────────────────────────────┘
                                                    │ @Input
                                                    ▼
                                             shared/ui
                                             erp-input-picker
```

### Podział odpowiedzialności

- **Moduł źródłowy** wystawia endpoint katalogowy, osobny od administracyjnego API. Sam decyduje o kształcie rekordu, dostępności i uprawnieniu do odczytu.
- **`@erp/shared/util`** zawiera interfejs portu, modele widokowe katalogu i `InjectionToken`. Nie zna URL-a ani HTTP.
- **`@erp/shared/data-access`** implementuje port: klient HTTP, wspólny cache, sklejanie żądań i funkcję `provide…Directory(baseUrl)`. Nie importuje `data-access` modułu źródłowego.
- **`@erp/shared/ui`** zawiera wyłącznie generyczne kontrolki. Nie ma komponentów nazwanych po domenie (`erp-user-picker`, `erp-language-picker`) i nie wstrzykuje tokenu katalogu.
- **`feature` modułu konsumenta** wstrzykuje port, definiuje domyślne etykiety/zasady pola i podaje konfigurację do generycznego pickera. Jest właścicielem własnego formularza oraz jego stanu.

Istniejący domenowy wrapper w `shared/ui` traktujemy jako dług techniczny do migracji, nie jako precedens dla następnego katalogu. Ta zasada obejmuje zarówno picker, jak i komponent wyświetlający nazwę, jeśli sam wstrzykuje port katalogu.

Folder `reference-data/` można stosować **wewnątrz** istniejących bibliotek dla czytelności, np. `shared/data-access/src/lib/reference-data/user/`. Nie jest to nowa biblioteka, warstwa ani scope.

### Procedura dla nowego katalogu

1. Ustal właściciela danych. Jeśli dane są modułowe, endpoint zostaje w tym module — nie powstaje centralny „moduł słowników” bez właścicielstwa biznesowego.
2. Zaprojektuj minimalne API odczytowe: wyszukiwanie stronicowane oraz pobranie po zestawie identyfikatorów. Nie wystawiaj klientom ekranu administracyjnego ani jego modeli.
3. Dodaj port i token do `shared/util`, a implementację cache’ującą oraz provider do `shared/data-access`.
4. Dodaj provider w hoście oraz w `app.config.ts` każdego remota, który może działać samodzielnie i używa katalogu.
5. W komponencie `feature` konsumenta zbuduj konfigurację dla `erp-input-picker` z portu; `shared/ui` dostaje dane/funkcje przez inputy.
6. Zadbaj o tłumaczenia etykiet w scope’ie modułu konsumenta i o fallback dla nieistniejącego lub wyłączonego rekordu.

### Kiedy ten wzorzec nie wystarcza

Jeżeli moduł konsumenta musi serwerowo sortować, filtrować lub eksportować po nazwie obcej encji, sam frontowy katalog nie wystarczy. Wtedy potrzebna jest świadoma projekcja/replika po stronie backendu przez zdarzenie integracyjne — nie obejście granic frontendu.

---

## 3. Przykład: użytkownik i język

| Dane  | Właściciel | Port                     | Kontrolka w formularzu                                            |
| ----- | ---------- | ------------------------ | ----------------------------------------------------------------- |
| Osoba | Identity   | `ERP_USER_DIRECTORY`     | `erp-input-picker` skonfigurowany w `feature` DMS/Task Management |
| Język | Languages  | `ERP_LANGUAGE_DIRECTORY` | `erp-input-picker` skonfigurowany w `feature` DMS/Task Management |

Oba przypadki mają identyczną architekturę, mimo że różnią się modelem rekordu i endpointem. Nie dodajemy dla nich nowych widżetów ani nowych warstw.

---

## 4. Checklist code review

- [ ] Czy cudzy gotowy UI renderuje się wyłącznie w stałym slocie hosta? Jeśli tak, widżet.
- [ ] Czy konsument jest właścicielem formularza/filtra? Jeśli tak, port + generyczny UI.
- [ ] Czy `shared/ui` nie zna typu domenowego, URL-a, tokenu ani serwisu HTTP?
- [ ] Czy kontrakt katalogowy jest minimalny i read-only?
- [ ] Czy cache jest wspólny na injector aplikacji, a pobrania po UUID są batchowane?
- [ ] Czy provider istnieje także w samodzielnie uruchamianym remote’ie?
- [ ] Czy przy potrzebie sortowania/filtrowania po obcej nazwie zaplanowano projekcję backendową?

Zobacz też: [architektura](./architecture.md), [użytkownicy poza Identity](./user-directory.md), [modale](./modals.md) i [atomy UI](./atoms.md).
