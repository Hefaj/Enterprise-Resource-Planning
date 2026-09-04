---
id: contributing.documentation
title: Współtworzenie dokumentacji
summary: Definition of Done, metadane, generowanie i review dokumentacji technicznej oraz użytkowej.
kind: contributing
scope: repository
audience: [contributor, reviewer, agent]
triggers: [aktualizacja dokumentacji po zmianie funkcji, review dokumentacji]
related: [reference.repository-map]
---

# Współtworzenie dokumentacji

## Granice treści

Trwałe reguły i bieżąca architektura należą do `docs/`. Jednorazowa kolejność wdrożenia należy do
`plans/`. Instrukcja obsługi działającej funkcji należy do dokumentacji użytkownika w warstwie
`feature` odpowiedniego modułu.

## Ocena wpływu zmiany

Dokumentacja użytkownika jest częścią Definition of Done, gdy zmiana dodaje lub zmienia ekran,
modal, akcję, przebieg, wymagane uprawnienie, rezultat albo ograniczenie operacji. Dotyczy to także
zmiany, przez którą istniejąca instrukcja prowadzi użytkownika nieaktualną drogą.

## Implementacja

1. Wybierz stabilny `capabilityId` i artykuł odpowiedzialny za przebieg.
2. Powiąż publiczną trasę przez `documentationArticleId` albo podaj jawny `documentationExemptReason`.
3. Utwórz artykuł poleceniem `pnpm docs:scaffold --module MODULE --article ARTICLE_ID`.
4. Uzupełnij odpowiadające sobie treści PL i EN, w tym uprawnienia oraz ograniczenia.
5. Uruchom `pnpm docs:generate` i `pnpm docs:check`.
6. Przejdź instrukcję w działającej aplikacji przed review.

Wygenerowane pliki TypeScript są wersjonowane, ale nie wolno ich edytować ręcznie. Indeks
wyszukiwania ma budżet ostrzegawczy 32 KiB na moduł i język. Po przekroczeniu budżetu najpierw
ogranicz powtórzenia w indeksie; bibliotekę wyszukującą oceniaj dopiero na podstawie pomiaru.

## Review

Reviewer sprawdza zgodność z UI, kompletność obu języków, język biznesowy, wymagane uprawnienia,
ograniczenia oraz działanie linków kontekstowych. Dokumentacja nie może przedstawiać atrapy ani
samego endpointu jako gotowej funkcji użytkowej.

Checklistę wpływu dokumentacji należy wypełnić także wtedy, gdy wynik brzmi „bez zmian”. Dzięki
temu nowa trasa bez `documentationArticleId` albo świadomego `documentationExemptReason` nie trafia
do głównej gałęzi przypadkiem.
