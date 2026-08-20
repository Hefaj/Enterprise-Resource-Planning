# Tłumaczenia (Transloco)

Lokalizacja i18n oparta o **Transloco**, z generatorem typowanych kluczy. Zasada nadrzędna: **zero hardcoded stringów** widocznych dla użytkownika w TS/HTML — wszystko idzie przez klucze z wygenerowanego rejestru.

---

## 1. Jak to działa w praktyce

W kodzie i szablonach nie pojawiają się zahardkodowane napisy (`"Filtruj"`, `"Nazwa produktu"`) — tylko silnie typowane klucze z obiektu rejestru wygenerowanego dla danego scope'u, np. `PRODUCT_KEYS.base.filters.name.placeholder`.

Atomy i molekuły UI (`erp-button`, `erp-input-text`, `erp-datepicker`, `erp-dynamic-filter`, `erp-modal`, `erp-table`...) są **"translation-aware"** — tłumaczenie dzieje się pod spodem w ich własnym szablonie, przez pipe `erpTranslate`:

```html
<label>{{ (_placeholder | erpTranslate) || '' }}</label>
```

Efekt: Smart Component przekazuje do konfiguracji **surowy klucz string**, nie przetłumaczony tekst — komponent prezentacyjny sam wie, jak go rozwiązać w aktualnym języku.

Konwencja kluczy: dot-notation, zaczyna się od nazwy scope'u — `product.base.filters.sku.label` (scope `product`), `shared.table.empty` (scope `shared`).

---

## 2. DI shadowing — dlaczego komponenty współdzielone nie rejestrują providerów tłumaczeń

To najczęstsza pułapka w tym systemie i warto rozumieć mechanizm, nie tylko zakaz.

Transloco rozwiązuje tłumaczenia przez wstrzykiwacz (DI) — komponent pyta o bieżący scope, a Angular szuka go w drzewie injectorów od komponentu w górę. Jeśli komponent współdzielony (np. coś w `libs/shared/ui/src/lib/atoms`) deklaruje:

```typescript
@Component({
  providers: [provideSharedTranslations()], // ❌ NIE RÓB TEGO w libs/shared/ui/**
  ...
})
```

— tworzy to **lokalny child injector**, który przesłania (shadowing) scope nadrzędny ustawiony przez moduł-hosta (np. `product`). Konsekwencja: błąd w runtime typu `Missing translation for 'product.base.tabs.products'`, bo komponent nagle "widzi" tylko scope `shared`, a nie scope modułu, w którym faktycznie jest renderowany.

**Zasada:** komponenty współdzielone używają wyłącznie pipe'a `erpTranslate` w szablonie — nigdy nie deklarują `providers` z Transloco. Globalne scope'y (`shared`) rejestruje się raz, u źródła:

- w `app.config.ts` hosta/remota (start aplikacji),
- w agregujących providerach modułu, np. `provideProductTranslations()`, który łączy w jednej tablicy provider scope'u `product` **i** `shared` (patrz sekcja 4).

---

## 3. Automatyczne wstrzykiwanie providerów w modalach

Definicje modali (np. `SetPriceModalDefinition`, patrz [dokumentacja modali](./modals.md)) **nie wołają** `.setProviders(...)` w builderze — to by wymagało, żeby każdy modal ręcznie pamiętał o doładowaniu tłumaczeń, i łatwo by się to rozjechało między modułami.

Zamiast tego `ErpModalService` sam pobiera i wstrzykuje odpowiednie providery przy leniwym ładowaniu modalu z remota — pod warunkiem, że kontrakt remota (`entry.modals.ts`) eksponuje funkcję `getModalProviders()`:

```typescript
export async function getModalProviders(): Promise<any[]> {
  const { provideProductTranslations } = await import('@erp/catalog/feature');
  return provideProductTranslations();
}
```

Dzięki temu otwieranie modalu działa identycznie w trybie monolitu (dev) i w trybie rozproszonym (MFE) — `ErpModalService` nie musi wiedzieć nic o konkretnym module, tylko wywołuje kontrakt, który sam mówi, jakich tłumaczeń potrzebuje.

---

## 4. Bootstrapping nowego scope'u tłumaczeń (nowy moduł / nowa funkcjonalność)

Każdy scope (moduł albo mniejsza funkcjonalność wewnątrz modułu) ma własny katalog `translation/`:

```
translation/
├── index.ts        # eksportuje funkcję rejestrującą (np. provideProductTranslations())
├── keys.ts          # AUTOMATYCZNIE GENEROWANY — nigdy nie edytuj ręcznie
├── pl-PL.json        # słownik polski — edytuj tutaj
└── en-US.json        # słownik angielski — edytuj tutaj
```

`index.ts` rejestruje scope własny **razem** ze scope'em `shared` (bo komponenty współdzielone renderowane w kontekście tego modułu muszą mieć dostęp do `shared.*`):

```typescript
import { provideTranslocoScope } from '@jsverse/transloco';

export function provideMODULE_NAMETranslations() {
  return [
    provideTranslocoScope({
      scope: 'MODULE_NAME',
      loader: {
        en: () => import('./en-US.json'),
        pl: () => import('./pl-PL.json'),
      },
    }),
    provideTranslocoScope('shared'),
  ];
}
```

To jest jednorazowa czynność przy tworzeniu modułu/funkcjonalności — patrz [nowy moduł, krok 4.4](./new-module.md#krok-4-uzupełnij-biblioteki).

---

## 5. Dodawanie nowych kluczy do istniejącego scope'u

To jest czynność, którą robisz **za każdym razem**, gdy dodajesz nowy tekst widoczny dla użytkownika:

1. Dodaj klucz i wartość do `pl-PL.json` w odpowiednim katalogu `translation/`.
2. Dodaj odpowiednik po angielsku w sąsiednim `en-US.json`.
3. Uruchom generator z głównego katalogu monorepo:
   ```bash
   pnpm translate:keys
   ```
   Skrypt skanuje repozytorium, odczytuje zadeklarowane scope'y z plików `index.ts` i (re)generuje `keys.ts` z pełnym typowaniem `as const`.
4. Importuj wygenerowany obiekt (np. `PRODUCT_KEYS`) i używaj go bezpośrednio — nigdy string literal.

**Nigdy nie edytuj `keys.ts` ręcznie** — kolejne uruchomienie generatora nadpisze ręczne zmiany bez ostrzeżenia, a rozjazd między `keys.ts` a `pl-PL.json`/`en-US.json` prowadzi do kluczy, które istnieją w typach, ale nie mają tłumaczenia w runtime (albo odwrotnie).

---

## Zobacz też

- [Modale](./modals.md) — `getModalProviders()` w praktyce
- [Struktura katalogów agregatu](./feature-structure.md) — gdzie leży katalog `translation/` agregatu
- [Nowy moduł](./new-module.md) — bootstrapping scope'u przy tworzeniu modułu
