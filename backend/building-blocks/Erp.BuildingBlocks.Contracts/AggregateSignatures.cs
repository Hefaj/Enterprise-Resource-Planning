namespace Erp.BuildingBlocks.Contracts;

/// <summary>
/// Sygnatury kanałów synchronizacji — <b>kontrakt między backendem a frontendem</b>, nie stałe pomocnicze.
///
/// Każda wartość musi zgadzać się co do znaku z <c>signalrSignature</c> w odpowiednim orkiestratorze
/// (<c>frontend/libs/modules/*/data-access/src/lib/orchestrators/**/*.orchestrator.ts</c>).
/// Literówka nie wywali buildu po żadnej stronie — po prostu aktualizacje w czasie rzeczywistym
/// przestaną cicho działać dla jednego agregatu. Dlatego jedno miejsce prawdy tutaj,
/// a nie stringi rozsiane po consumerach.
///
/// Konwencja: <c>{moduł}.{agregat}</c>, lowercase, kropka jako separator.
/// </summary>
public static class AggregateSignatures
{
    public const string CatalogProduct = "catalog.product";
    public const string CatalogCategory = "catalog.category";
    public const string CatalogModel = "catalog.model";
    public const string CatalogMultimedia = "catalog.multimedia";
    public const string CatalogWarranty = "catalog.warranty";

    /// <summary>Słownik typów kodów produktu.</summary>
    public const string CatalogCodeType = "catalog.codetype";

    /// <summary>Słownik definicji atrybutów produktu.</summary>
    public const string CatalogAttribute = "catalog.attribute";

    /// <summary>
    /// Przebiegi eksportu (patrz <c>docs/backend/exports-artifacts.md</c>).
    ///
    /// <para>Ten kanał służy synchronizacji cache — leci na niego zmiana statusu przebiegu
    /// do WSZYSTKICH subskrybentów sygnatury. Powiadomieniem „twój eksport jest gotowy" jest
    /// kanał <see cref="Jobs"/>, adresowany do grupy <c>user:{userId}</c>. Pomylenie tych dwóch
    /// daje odświeżenie danych u wszystkich i powiadomienie u nikogo.</para>
    /// </summary>
    public const string CatalogExportRun = "catalog.export_run";

    public const string NotificationJob = "notification.job";

    /// <summary>Jedyny agregat modułu Sales, dodany jako sprawdzian szablonu (faza 5) —
    /// bez odpowiednika po stronie frontendu, dopóki Sales nie dostanie realnej funkcji.</summary>
    public const string SalesCustomer = "sales.customer";

    /// <summary>
    /// Kanał statusów zadań, osobny od <see cref="NotificationJob"/> i celowo NIE nazwany
    /// wg konwencji <c>{moduł}.{agregat}</c>.
    ///
    /// Różnica jest istotna: na <see cref="NotificationJob"/> lecą <b>uuid agregatów Job</b>
    /// (orkiestrator odświeża wtedy swój cache przez <c>getJob</c>), natomiast na tym kanale
    /// lecą <b>trackingID</b> zadań, których słucha <c>JobService</c>
    /// (<c>frontend/libs/shared/data-access/src/lib/orchestrator/job.service.ts</c>:
    /// <c>onUpdate('jobs')</c>) żeby oznaczyć zadanie jako zakończone bez odpytywania API.
    /// </summary>
    public const string Jobs = "jobs";

    /// <summary>Projekcja użytkownika (role, uprawnienia bezpośrednie) — zmiana napędza
    /// odświeżenie <c>PermissionStore</c> na froncie (Faza 5) i unieważnienie cache'u
    /// uprawnień w innych mikroserwisach (Faza 3, <c>UserPermissionsChanged</c>).</summary>
    public const string IdentityUser = "identity.user";

    public const string IdentityRole = "identity.role";

    /// <summary>
    /// Zgłoszenie w module Task Management. Prefiks to <c>taskmgmt</c>, nie <c>task</c> —
    /// <see cref="Jobs"/> i <see cref="NotificationJob"/> zajmują już pole semantyczne
    /// „zadanie” i w logach nie dałoby się ich rozróżnić
    /// (<c>docs/backend/task-management.md</c> §2).
    /// </summary>
    public const string TaskManagementIssue = "taskmgmt.issue";

    public const string TaskManagementProject = "taskmgmt.project";

    /// <summary>Załącznik zgłoszenia — obrazek w opisie albo plik dopięty obok. Osobny kanał,
    /// bo wgranie pliku nie zmienia samego zgłoszenia, a karta ma odświeżyć listę plików.</summary>
    public const string TaskManagementIssueAttachment = "taskmgmt.issue_attachment";

    /// <summary>Komentarz pod zgłoszeniem. Osobny kanał od <see cref="TaskManagementIssue"/>,
    /// bo dyskusja toczy się bez zmiany samego zgłoszenia — a karta ma dopisać cudzą wypowiedź
    /// bez przeładowania (<c>docs/backend/task-management.md</c> §11).</summary>
    public const string TaskManagementIssueComment = "taskmgmt.issue_comment";

    /// <summary>Schemat stanów. Zmiana schematu przestawia kolumny tablicy i przyciski przejść
    /// na karcie u wszystkich naraz, więc jest zdarzeniem realtime, a nie konfiguracją
    /// odczytywaną raz przy starcie aplikacji.</summary>
    public const string TaskManagementWorkflowScheme = "taskmgmt.workflow_scheme";

    /// <summary>Tablica i kolejność kart — kanał wchodzi w fazie 2
    /// (<c>docs/backend/task-management.md</c> §7.4).</summary>
    public const string TaskManagementBoard = "taskmgmt.board";

    /// <summary>Wszystkie sygnatury agregatów — do walidacji przy starcie i w testach,
    /// żeby nikt nie rozgłosił zmiany na kanał, którego nikt nie słucha.</summary>
    public static IReadOnlySet<string> All { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        CatalogProduct,
        CatalogCategory,
        CatalogModel,
        CatalogMultimedia,
        CatalogWarranty,
        CatalogCodeType,
        CatalogAttribute,
        CatalogExportRun,
        NotificationJob,
        SalesCustomer,
        Jobs,
        IdentityUser,
        IdentityRole,
        TaskManagementIssue,
        TaskManagementIssueAttachment,
        TaskManagementIssueComment,
        TaskManagementProject,
        TaskManagementWorkflowScheme,
        TaskManagementBoard,
    };
}
