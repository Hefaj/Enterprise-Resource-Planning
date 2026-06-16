---
trigger: always_on
---

# Architektura Tłumaczeń i Lokalizacja (Transloco + Generator)

W projekcie używamy biblioteki **Transloco** do lokalizacji i internacjonalizacji aplikacji. Wszystkie teksty widoczne dla użytkownika muszą być tłumaczone w sposób dynamiczny i typowany.

---

## 1. Zasada Działania Tłumaczeń

1. **Separacja i Klucze:** W kodzie TypeScript oraz szablonach HTML nie używamy zahardkodowanych napisów (np. `"Filtruj"`, `"Nazwa produktu"`). Zamiast tego używamy silnie typowanych kluczy z obiektów rejestru (np. `PRODUCT_KEYS.base.filters.name.placeholder`).
2. **Klucze pod spodem:** Wszystkie atomy UI (`erp-button`, `erp-input-text`, `erp-datepicker`) oraz molekuły/organizmy (`erp-dynamic-filter`, `erp-modal`, `erp-table`) są **"translation-aware"**. Tłumaczenie odbywa się pod spodem bezpośrednio w ich szablonach HTML za pomocą pipe'a `transloco`, np.:
   ```html
   <label>{{ (_placeholder | transloco) || '' }}</label>
   ```
   Dzięki temu komponenty wyższego rzędu (Smart Components) przekazują do konfiguracji wyłącznie surowe klucze string.
3. **Konwencja Nazewnictwa:** Klucze są kropkowane (dot-notation) i zaczynają się od nazwy scope'u (np. `product.base.filters.sku.label` dla scope'u `product`, lub `shared.table.empty` dla scope'u `shared`).

---

## 2. Unikanie DI Shadowing (Cień Wstrzykiwania)

> [!IMPORTANT]
> **Komponenty współdzielone (np. w `libs/shared/ui/src/lib/atoms` oraz `libs/shared/ui/src/lib/molecules`) nie mogą definiować dostawców tłumaczeń w dekoratorze komponentu!**
> 
> Zapis `providers: [provideSharedTranslations()]` w dekoratorze `@Component` tworzy lokalny wstrzykiwacz potomny (child injector), co nadpisuje i blokuje główny wstrzykiwacz scope'uTransloco (np. `product`). Powoduje to błędy typu `Missing translation for 'product.base.tabs.products'`.
>
> **Zamiast tego:**
> - Używaj wyłącznie pipe'a `transloco` w HTML.
> - Globalne scope'y (`shared`) rejestrujemy w głównym wstrzykiwaczu aplikacji (`app.config.ts` hosta/remote) oraz agregujemy w dostawcach modułów, np. `provideProductTranslations()` łączy w tablicy dostawcę `product` oraz `shared`.

---

## 3. Automatyczne Generowanie `keys.ts` (Generator)

Wszystkie klucze są silnie typowane w plikach `keys.ts` (np. `PRODUCT_KEYS` dla modułu catalog/product, `SHARED_KEYS` dla shared/ui). **Zabrania się ręcznej edycji plików `keys.ts`.**

### Procedura dodawania nowych tłumaczeń:
1. Dodaj odpowiednie tłumaczenia do pliku `pl-PL.json` w odpowiednim folderze `translation` (np. `frontend/libs/modules/catalog/feature/src/lib/product/translation/pl-PL.json`).
2. Dodaj odpowiedniki w języku angielskim w sąsiednim pliku `en-US.json`.
3. Uruchom generator w głównym katalogu projektu:
   ```bash
   pnpm translate:keys
   ```
   *Skrypt automatycznie przeskanuje monorepo, odczyta zadeklarowane scope'y z plików `index.ts` i wygeneruje/zaktualizuje pliki `keys.ts` z poprawnym typowaniem `as const`.*

---

## 4. Struktura Folderu Translation

Każdy moduł/funkcjonalność posiadający własny scope tłumaczeń posiada strukturę:
```
translation/
├── index.ts        # Eksportuje loader Transloco (np. provideProductTranslations())
├── keys.ts         # AUTOMATYCZNIE GENEROWANY (Nie edytuj ręcznie!)
├── pl-PL.json      # Słownik języka polskiego (Wypełniaj tutaj!)
└── en-US.json      # Słownik języka angielskiego (Wypełniaj tutaj!)
```
