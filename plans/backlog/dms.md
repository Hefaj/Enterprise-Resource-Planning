# DMS — plan implementacji

> **Status:** backlog
> **Źródło trwałych reguł:** `docs/modules/dms/domain-workflow.md` i `docs/modules/dms/screens.md`

## Kolejność

1. Utworzyć mikroserwis, schemat, `Document`, `DocumentType`, typowane sloty, upload i serwerową listę; zastąpić atrapę frontu.
2. Dodać silnik tokenów, snapshot definicji, `WorkItem`, skrzynkę czynności i cofanie.
3. Dodać edytor, wersjonowanie i publikację szablonów z walidacją konfiguracji.
4. Dodać `document_acl` oraz audyt nadań per dokument.
5. Dodać bloki automatyczne, harmonogram, SLA, eskalacje i rozgałęzienia równoległe.
6. Dodać archiwizację, klasę artefaktu archival, metrykę PDF, hash i retencję read-only.
7. Dodać inbox, KSeF, deduplikację, reguły routingu i triage.
8. Dodać delegacje, przekierowanie, masową akceptację i podpis.

Każdy krok publikuje wyłącznie ekrany mające podpięty backend, uprawnienia i test przebiegu.
