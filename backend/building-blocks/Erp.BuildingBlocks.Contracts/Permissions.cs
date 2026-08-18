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
    ];
}
