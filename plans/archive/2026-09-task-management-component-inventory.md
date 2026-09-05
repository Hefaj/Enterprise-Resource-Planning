# Task Management — inwentaryzacja komponentów `feature`

Załącznik do [`task-management-ui-refactor.md`](task-management-ui-refactor.md), etap 1. Każdy
`*.component.ts` z `frontend/libs/modules/task-management/feature/src/lib/` sklasyfikowany wg
roli docelowej. Komponenty już wydzielone do `task-management/ui` (`erp-issue-card`, `erp-issue-key`,
`erp-activity-stream`, `erp-field-panel`, `erp-link-list`, `erp-tag-chips`, `erp-board-column`,
`erp-board-toolbar`, `erp-work-log-panel`, `erp-workflow-editor`, `erp-automation-rule-editor`,
`erp-project-configuration-section`, `erp-issue-detail-header`, `erp-workflow-transition-cell`,
`erp-project-tag-list`, `erp-report-pivot-label-cell`) nie są tu ponownie wypisane jako kandydaci.
**Etap 2 usunął** `erp-configuration-data-table`, `erp-report-data-table` i `erp-report-pivot-table`
z `task-management/ui` — zastąpione bezpośrednim użyciem `erp-table` (shared/ui) w feature; patrz
sekcja niżej i wpis etapu 2 w planie głównym.

Legenda kolumny „Rola": **smart** (zostaje w feature), **ui-candidate** (kandydat do
`task-management/ui`), **shared-candidate** (kandydat do `shared/ui`), **local** (zostaje jako
kompozycja strony, nie warto wydzielać).

| Plik | Rola | Miejsce docelowe | Uzasadnienie | Surowy table/select/input? |
|---|---|---|---|---|
| **Board** | | | | |
| `board/page/board.component.ts` | smart | feature | Wstrzykuje `BoardStore`, `ActivatedRoute`, `Router`; właściciel drag&drop, swimlane'ów, przekierowania domyślnej tablicy | nie |
| `board/page/board-list.component.ts` | smart | feature | Wstrzykuje `TaskManagementBoardOrchestrator`, `Router`; ładowanie listy i przekierowanie przy jednej tablicy | nie |
| `board/page/backlog.component.ts` | smart | feature | Wstrzykuje `BacklogStore`, `ActivatedRoute`; komendy startu/zamknięcia sprintu, routing dropów backlog↔sprint | nie |
| **Issue** | | | | |
| `issue/components/tables/task-management-issue-table/issue-key-cell.component.ts` | ui-candidate | `task-management/ui` | Czysto prezentacyjny wrapper na `erp-issue-key`, tylko `input()`/`computed()`, bez DI serwisów/store'ów | nie |
| `issue/components/tables/task-management-issue-table/task-management-issue-table.component.ts` | smart | feature | Wstrzykuje orkiestratory (`Issue`, `Tag`), `ProjectFieldProfileService`, `UserDirectoryService`, `ErpToastService`; serwerowe pobieranie/paginacja/kolumny z profilu | nie |
| `issue/page/content/issue-activity.component.ts` | smart | feature | Wstrzykuje `IssueCommentService`, `IssueActivityService`, orkiestrator, `ErpAuthService`; komendy komentarzy/odpowiedzi/edycji, nakładka optymistyczna | nie |
| `issue/page/content/issue-attachments.component.ts` | smart | feature | Wstrzykuje `IssueAttachmentService`, `IssueAttachmentContentService`, `ErpMediaPreviewService`, `ErpConfirmDialogService`; adapter domenowy nad `erp-file-upload-list` (shared/ui, etap 2) — komendy upload/usuń | nie (od etapu 2: wybór/postęp/lista przeniesione do `erp-file-upload-list`) |
| `issue/page/content/issue-custom-fields.component.ts` | smart | feature | Wstrzykuje `ProjectFieldProfileService`, orkiestrator; dynamiczny formularz z profilu pól + komenda `IssueSetCustomFieldsCommand` | nie |
| `issue/page/content/issue-external-links.component.ts` | smart | feature | Wstrzykuje orkiestrator, `ErpConfirmDialogService`, `ErpToastService`; komendy dodania/usunięcia linku zewnętrznego | nie |
| `issue/page/content/issue-links.component.ts` | smart | feature | Wstrzykuje `IssueGraphService`, `JobService`, orkiestrator; ładowanie grafu powiązań (renderuje przez `erp-link-list`) | nie |
| `issue/page/content/issue-tab.component.ts` | smart | feature | Wstrzykuje orkiestrator, `PermissionStore`, `ErpModalService`, `ErpAuthService`, `Router`, `IssueStore`; toolbar akcji masowych/modale | nie |
| `issue/page/content/issue-tags.component.ts` | smart | feature | Wstrzykuje orkiestratory `Tag`/`Issue`, `PermissionStore`, `JobService`; komendy dodania/usunięcia tagu (renderuje przez `erp-tag-chips`) | nie |
| `issue/page/content/issue-time.component.ts` | smart | feature | Wstrzykuje `IssueWorkLogService`, `TaskManagementWorkTypeOrchestrator`, `PermissionStore`, `ErpConfirmDialogService`; komendy wpisu czasu | nie |
| `issue/page/filters/issue-filter.component.ts` | smart | feature | Wstrzykuje `IssueStore`, orkiestratory (`Issue`/`Project`/`Tag`), `Router`, `ERP_USER_DIRECTORY`; stan filtra/routing wokół `erp-filter` | nie |
| `issue/page/issue.component.ts` | local | feature (bez zmian) | Czysta kompozycja strony — brak DI, tylko `ErpGridLayoutBuilder` ze slotami filtra/treści; nie warto wydzielać | nie |
| `issue/page/issue-detail.component.ts` | smart | feature | Wstrzykuje orkiestratory `Issue`/`IssueTypeScheme`, `ProjectWorkflowService`, `ErpModalService`, `PermissionStore`, `Router`; pełna orkiestracja karty | nie |
| **Project** | | | | |
| `project/components/tables/task-management-project-table/task-management-project-table.component.ts` | smart | feature | Wstrzykuje orkiestratory `Project`/`FieldScheme`; serwerowe pobieranie/kolumny (owija `erp-table`) | nie |
| `project/page/content/project-automations.component.ts` | smart | feature | Wstrzykuje `TaskManagementAutomationRuleOrchestrator`, `ErpConfirmDialogService`; formularz reguły renderuje przez `erp-automation-rule-editor` (etap 3), feature zostaje właścicielem cache `FormControl` per wiersz i komend | nie |
| `project/page/content/project-fields.component.ts` | smart | feature | Wstrzykuje `FieldScheme`/`ProjectFieldProfileService`/`Project` orkiestratory; konfiguracja schematu pól | nie |
| `project/page/content/project-notifications.component.ts` | smart | feature | Wstrzykuje `TaskManagementProjectOrchestrator`; przełącznik powiadomień na DTO projektu | nie |
| `project/page/content/project-sla.component.ts` | smart | feature | Wstrzykuje `TaskManagementProjectOrchestrator`; formularz/zapis konfiguracji SLA | nie |
| `project/page/content/project-tab.component.ts` | local | feature (bez zmian) | Cienki wrapper spinający filtry `ProjectStore` z `erp-task-management-project-table` i nawigacją — zbyt mało logiki, by wydzielać | nie |
| `project/page/content/project-tags.component.ts` | smart | feature | Wstrzykuje `TaskManagementTagOrchestrator`, `PermissionStore`, `ErpConfirmDialogService`; CRUD tagów | nie |
| `project/page/content/project-types.component.ts` | smart | feature | Wstrzykuje `IssueTypeScheme`/`Project` orkiestratory, `ErpConfirmDialogService`; komendy schematu typów zgłoszeń | nie |
| `project/page/content/project-webhooks.component.ts` | smart | feature | Wstrzykuje `TaskManagementWebhookOrchestrator`, `ErpConfirmDialogService`; CRUD/dostawy webhooków | nie |
| `project/page/content/project-workflow-scheme.component.ts` | smart | feature | Wstrzykuje `WorkflowSchemeOrchestrator`, `ErpModalService`, `ErpConfirmDialogService`; macierz przejść renderuje przez `erp-workflow-editor` (etap 3), stany przez `erp-table` (etap 2) | nie |
| `project/page/filters/project-filter.component.ts` | smart | feature | Wstrzykuje `ProjectStore`, `TranslocoService`; stan filtra wokół `erp-filter` | nie |
| `project/page/project.component.ts` | local | feature (bez zmian) | Czysta kompozycja strony — brak DI, `ErpGridLayoutBuilder` ze slotami filtra/treści | nie |
| `project/page/project-detail.component.ts` | smart | feature | Wstrzykuje `TaskManagementProjectOrchestrator`, `ErpConfirmDialogService`, routing; routing zakładek i komendy mutacji projektu | nie |
| **Report** | | | | |
| `report/page/report.component.ts` | smart | feature | Wstrzykuje `ReportStore`, `TranslocoService`, `ERP_USER_DIRECTORY`; wybór definicji/parametrów/eksport, buduje `ErpTableConfig` wprost (`erp-table`, etap 2) dla obu ścieżek wyników | nie |
| **Request** | | | | |
| `request/page/filters/request-filter.component.ts` | smart | feature | Wstrzykuje `IssueStore`, `TaskManagementProjectOrchestrator`, `TranslocoService`; filtr zawężony do projektów Intake | nie |
| `request/page/request.component.ts` | local | feature (bez zmian) | Czysta kompozycja strony — reużywa `IssueStore`/`IssueTabComponent`, podmienia `RequestFilterComponent` w konfiguracji grid layout | nie |
| **Documentation** | | | | |
| `documentation/page/documentation.component.ts` | smart | feature | Wstrzykuje `TaskManagementDocumentationStore`, routing, `Title`; nawigacja artykułów/wyszukiwanie | nie |

## Wyjątki od reguły „bez surowego table/select/input" (`no-restricted-syntax` w `frontend/libs/modules/task-management/feature/eslint.config.mjs`)

**Brak wyjątków.** Oba wcześniejsze przypadki są zamknięte:

- `issue-attachments.component.ts` — etap 2 przeniósł wybór plików (`<input tuiInputFiles>`),
  postęp, listę i błędy do `erp-file-upload-list` w `shared/ui`
  (`frontend/libs/shared/ui/src/lib/molecules/erp-file-upload-list/`). Ten sam port jest gotowy
  dla Catalogu (`ProductAddMultimediaStepComponent` ma dziś niemal identyczną, osobną
  implementację) i DMS bez importu z `@erp/task-management/*` — `shared/ui` zależy wyłącznie od
  `scope:shared`.
- `project-workflow-scheme.component.ts` — etap 3 przeniósł macierz przejść „z → do" (`<table>`)
  do `erp-workflow-editor` w `task-management/ui`.

Reguła jest aktywna i weryfikowalna: `pnpm exec nx lint task-management-feature` (wpis nowego
surowego `<table>`/`<select>`/`<input>` w dowolnym pliku feature kończy się błędem lintera).
