# Obserwowalność — plan wdrożenia

> **Status:** backlog
> **Źródło trwałych reguł:** `docs/operations/observability.md`

## Kolejność

1. Wystawić `health/live`, `health/ready` i zewnętrzną czujkę spoza klastra.
2. Zebrać logi strukturalne i korelować je przez `X-Request-Id` oraz `traceId`.
3. Włączyć alerty domenowe: outbox, dead letters, job bez postępu, liczba Relayów i wolne miejsce.
4. Podłączyć OpenTelemetry, metryki i śledzenie rozproszone.
5. Ustawić retencję, limity, circuit breaker Identity i regularne testy odtworzenia backupu.

Każdy krok ma własny dowód operacyjny; dashboard bez alertu i właściciela reakcji nie zamyka zadania.
