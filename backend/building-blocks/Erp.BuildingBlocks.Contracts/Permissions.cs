namespace Erp.BuildingBlocks.Contracts;

/// <summary>
/// Jedna definicja uprawnienia w katalogu — patrz <see cref="Permissions"/>.
/// </summary>
/// <param name="Code">Kod w konwencji <c>{moduł}.{zasób}.{akcja}</c>, lowercase, kropka.</param>
/// <param name="Module">Moduł biznesowy — grupuje katalog w UI (patrz Identity/permissions).</param>
/// <param name="Resource">Zasób w obrębie modułu (np. <c>product</c>, <c>customer</c>).</param>
/// <param name="Action">Akcja (np. <c>read</c>, <c>update</c>, <c>bulk</c>).</param>
/// <param name="DescriptionKey">Klucz Transloco opisu — NIE tekst. Opis w UI idzie przez
/// tłumaczenia, zgodnie z regułą zero-hardcoded-strings (patrz CLAUDE.md).</param>
public sealed record PermissionDefinition(
    string Code, string Module, string Resource, string Action, string DescriptionKey);

/// <summary>
/// Katalog uprawnień systemu — <b>kod, nie dane</b>. Na tych samych prawach co
/// <see cref="AggregateSignatures"/>: jedno źródło prawdy, wersjonowane razem z kodem,
/// które je sprawdza. Strona "Uprawnienia" w module Identity jest read-only przeglądarką
/// tego katalogu — formularz "dodaj uprawnienie" produkowałby wiersze, których żaden
/// <c>if</c> w kodzie nie sprawdza (patrz <c>docs/backend/identity-authz.md</c> §3).
///
/// <para>Przy starcie <c>Identity</c> uzgadnia ten katalog z tabelą <c>permission_catalog</c>:
/// dopisuje nowe kody, znikające oznacza <c>is_obsolete = true</c> — nigdy nie kasuje, bo
/// istniejące nadania mogą na nie wskazywać (patrz <c>PermissionCatalogReconciler</c>).</para>
///
/// <para><b>Faza 2 wprowadza katalog i mechanizm uzgadniania; faza 3 dopina do niego
/// rzeczywiste sprawdzanie na endpointach Catalog/Sales/Notification</b> — kody poniżej
/// są już stabilnym kontraktem, ale jeszcze nieegzekwowanym poza Identity.</para>
/// </summary>
public static class Permissions
{
    public static class Catalog
    {
        public const string ProductRead = "catalog.product.read";
        public const string ProductUpdate = "catalog.product.update";
        public const string ProductBulk = "catalog.product.bulk";
        public const string CategoryRead = "catalog.category.read";
        public const string CategoryUpdate = "catalog.category.update";

        /// <summary>Odczyt słowników pomocniczych (modele, gwarancje, typy kodów, atrybuty)
        /// oraz zawartości multimediów — jedno uprawnienie zamiast czterech prawie identycznych
        /// kodów. Rozbić na osobne, gdy któryś dostanie własną mutację.</summary>
        public const string DictionaryRead = "catalog.dictionary.read";

        /// <summary>
        /// Wgrywanie plików do katalogu i dopinanie ich do produktów.
        ///
        /// <para>Wydzielone z <see cref="DictionaryRead"/>, bo multimedia są pierwszym słownikiem
        /// z własną mutacją — dokładnie ten przypadek, który komentarz przy tamtym kodzie
        /// przewidywał. Odczyt zostaje w słownikowym: kto widzi produkt, widzi jego zdjęcia.</para>
        /// </summary>
        public const string MultimediaUpdate = "catalog.multimedia.update";

        public const string JobControl = "catalog.job.control";

        /// <summary>Zlecenie raportu/eksportu katalogu i pobranie gotowego artefaktu —
        /// patrz <c>docs/backend/reporting.md</c>.</summary>
        public const string ReportRunCreate = "catalog.report_run.create";
    }

    public static class Sales
    {
        public const string CustomerRead = "sales.customer.read";
        public const string CustomerUpdate = "sales.customer.update";
        public const string CustomerBulk = "sales.customer.bulk";
    }

    public static class Notification
    {
        public const string JobRead = "notification.job.read";
        public const string JobControl = "notification.job.control";
    }

    public static class Identity
    {
        public const string UserRead = "identity.user.read";
        public const string UserManage = "identity.user.manage";
        public const string RoleRead = "identity.role.read";
        public const string RoleManage = "identity.role.manage";
        public const string PermissionRead = "identity.permission.read";

        /// <summary>Sterowanie zadaniami masowymi Identity (`job/cancel`, `job/retry-failed`) —
        /// patrz Faza 0 w <c>docs/backend/identity-bulk-migration.md</c>.</summary>
        public const string JobControl = "identity.job.control";
    }

    /// <summary>
    /// Task Management. Prefiks kodów to <c>taskmgmt</c>, spójnie ze schematem bazy
    /// i sygnaturami SignalR (<c>docs/backend/task-management.md</c> §2, §10.2).
    ///
    /// <para><b>Rola w projekcie nie jest uprawnieniem.</b> Te kody odpowiadają na pytanie
    /// „czy w ogóle wolno ci ruszać zgłoszenia”; „w których projektach” rozstrzyga
    /// <c>project_member</c> jako atrybut nadania. Odwrotnie katalog rósłby z liczbą działów.</para>
    /// </summary>
    public static class TaskManagement
    {
        public const string IssueRead = "taskmgmt.issue.read";
        public const string IssueCreate = "taskmgmt.issue.create";
        public const string IssueUpdate = "taskmgmt.issue.update";
        public const string IssueBulk = "taskmgmt.issue.bulk";

        /// <summary>Zarządzanie tablicami — kod istnieje od fazy 0, żeby menu i katalog
        /// uprawnień nie zmieniały się przy dołożeniu ekranu w fazie 2.</summary>
        public const string BoardManage = "taskmgmt.board.manage";

        public const string ProjectManage = "taskmgmt.project.manage";

        public const string SchemeManage = "taskmgmt.scheme.manage";

        /// <summary>Zakładanie tagów w locie (TAG-002) — bez tego uprawnienia użytkownik wybiera
        /// tylko z istniejących, żeby swoboda zakładania nie skończyła się listą z `backend`,
        /// `back-end` i `Backend`.</summary>
        public const string TagManage = "taskmgmt.tag.manage";

        /// <summary>Uruchamianie i odczyt raportów Task Management (PERM-005). Bramkuje wyłącznie
        /// endpointy raportów — świadomie NIE wchodzi w predykat widoczności zgłoszeń
        /// (patrz <c>docs/backend/task-management-requirements.md</c> PERM-005 AC3).</summary>
        public const string ReportReadAll = "taskmgmt.report.read.all";

        /// <summary>Zarządzanie regułami automatyzacji (faza 8, AUT-001) — nowa funkcja, nie
        /// rozszerzenie istniejącego kodu (zasada z `PLAN-task-management.md` §9). Gates
        /// tworzenie/edycję/włączanie/wyłączanie/usuwanie i odczyt — kto nie zarządza
        /// automatyzacją, nie widzi logiki jej reguł.</summary>
        public const string AutomationManage = "taskmgmt.automation.manage";

        /// <summary>Zarządzanie webhookami wychodzącymi (faza 8, API-004) — nowa funkcja, gates
        /// tworzenie/edycję/włączanie/wyłączanie/usuwanie i odczyt wzorem
        /// <see cref="AutomationManage"/>, którego jest bezpośrednim odpowiednikiem.</summary>
        public const string WebhookManage = "taskmgmt.webhook.manage";
    }

    /// <summary>Pełny katalog — źródło seedu <c>permission_catalog</c> i uzgadniania przy starcie.
    /// Nowy moduł dopisuje tu swoją grupę kodów; usunięcie kodu NIE usuwa go z bazy
    /// (patrz <see cref="PermissionDefinition"/>).</summary>
    public static IReadOnlyList<PermissionDefinition> All { get; } =
    [
        new(Catalog.ProductRead, "catalog", "product", "read", "identity.permissions.catalog.product.read"),
        new(Catalog.ProductUpdate, "catalog", "product", "update", "identity.permissions.catalog.product.update"),
        new(Catalog.ProductBulk, "catalog", "product", "bulk", "identity.permissions.catalog.product.bulk"),
        new(Catalog.CategoryRead, "catalog", "category", "read", "identity.permissions.catalog.category.read"),
        new(Catalog.CategoryUpdate, "catalog", "category", "update", "identity.permissions.catalog.category.update"),
        new(Catalog.DictionaryRead, "catalog", "dictionary", "read", "identity.permissions.catalog.dictionary.read"),
        new(Catalog.MultimediaUpdate, "catalog", "multimedia", "update", "identity.permissions.catalog.multimedia.update"),
        new(Catalog.JobControl, "catalog", "job", "control", "identity.permissions.catalog.job.control"),
        new(Catalog.ReportRunCreate, "catalog", "report_run", "create", "identity.permissions.catalog.reportRun.create"),

        new(Sales.CustomerRead, "sales", "customer", "read", "identity.permissions.sales.customer.read"),
        new(Sales.CustomerUpdate, "sales", "customer", "update", "identity.permissions.sales.customer.update"),
        new(Sales.CustomerBulk, "sales", "customer", "bulk", "identity.permissions.sales.customer.bulk"),

        new(Notification.JobRead, "notification", "job", "read", "identity.permissions.notification.job.read"),
        new(Notification.JobControl, "notification", "job", "control", "identity.permissions.notification.job.control"),

        new(Identity.UserRead, "identity", "user", "read", "identity.permissions.identity.user.read"),
        new(Identity.UserManage, "identity", "user", "manage", "identity.permissions.identity.user.manage"),
        new(Identity.RoleRead, "identity", "role", "read", "identity.permissions.identity.role.read"),
        new(Identity.RoleManage, "identity", "role", "manage", "identity.permissions.identity.role.manage"),
        new(Identity.PermissionRead, "identity", "permission", "read", "identity.permissions.identity.permission.read"),
        new(Identity.JobControl, "identity", "job", "control", "identity.permissions.identity.job.control"),

        new(TaskManagement.IssueRead, "taskmgmt", "issue", "read", "identity.permissions.taskmgmt.issue.read"),
        new(TaskManagement.IssueCreate, "taskmgmt", "issue", "create", "identity.permissions.taskmgmt.issue.create"),
        new(TaskManagement.IssueUpdate, "taskmgmt", "issue", "update", "identity.permissions.taskmgmt.issue.update"),
        new(TaskManagement.IssueBulk, "taskmgmt", "issue", "bulk", "identity.permissions.taskmgmt.issue.bulk"),
        new(TaskManagement.BoardManage, "taskmgmt", "board", "manage", "identity.permissions.taskmgmt.board.manage"),
        new(TaskManagement.ProjectManage, "taskmgmt", "project", "manage", "identity.permissions.taskmgmt.project.manage"),
        new(TaskManagement.SchemeManage, "taskmgmt", "scheme", "manage", "identity.permissions.taskmgmt.scheme.manage"),
        new(TaskManagement.TagManage, "taskmgmt", "tag", "manage", "identity.permissions.taskmgmt.tag.manage"),
        new(TaskManagement.ReportReadAll, "taskmgmt", "report", "read.all", "identity.permissions.taskmgmt.report.readAll"),
        new(TaskManagement.AutomationManage, "taskmgmt", "automation", "manage", "identity.permissions.taskmgmt.automation.manage"),
        new(TaskManagement.WebhookManage, "taskmgmt", "webhook", "manage", "identity.permissions.taskmgmt.webhook.manage"),
    ];
}
