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

    /// <summary>Wszystkie sygnatury agregatów — do walidacji przy starcie i w testach,
    /// żeby nikt nie rozgłosił zmiany na kanał, którego nikt nie słucha.</summary>
    public static IReadOnlySet<string> All { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        CatalogProduct,
        CatalogCategory,
        CatalogModel,
        CatalogMultimedia,
        CatalogWarranty,
        NotificationJob,
        SalesCustomer,
        Jobs,
    };
}
