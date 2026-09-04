# Powiadomienia użytkownika — plan rozwoju

> **Status:** backlog
> **Źródło trwałych reguł:** `docs/modules/notification/user-notifications.md`

## Kolejność

1. Utrzymać `UserNotification`, fan-out i deduplikację dla kolejnych producentów zdarzeń.
2. Dodać trwałe grupowanie (`GroupKey`, `occurrence_count`) i pełną skrzynkę z filtrami.
3. Dodać katalog rodzajów, preferencje użytkownika i ekran ustawień.
4. Dodać kanał e-mail, locale profilu, szablony i klastrowo bezpieczny worker z retry.
5. Domknąć retencję, sprzątanie, limity odbiorców i alerty rozjazdu katalogu rodzajów.

Kanał `jobs` pozostaje oddzielny; producent biznesowy nadal wylicza odbiorców i zakres ujawnianej treści.
