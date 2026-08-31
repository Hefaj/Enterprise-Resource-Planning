namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Kto i w ramach czego wykonuje bieżącą operację. Wypełniane na granicy HTTP (z tokenu JWT
/// i nagłówków), a przy wykonaniu zadania masowego w tle — odtwarzane z wiersza <c>job</c>,
/// bo tam nie ma już żądania HTTP, a zadanie nadal „należy” do użytkownika, który je zlecił.
///
/// To odtworzenie jest powodem, dla którego jest tu osobna abstrakcja zamiast wstrzykiwania
/// <c>IHttpContextAccessor</c>: <c>BulkCommandRunner</c> musi umieć podstawić kontekst
/// zleceniodawcy dla chunka wykonywanego godzinę po tym, jak jego połączenie się zamknęło.
/// </summary>
public interface IExecutionContext
{
    /// <summary>Identyfikator użytkownika; decyduje, do której grupy SignalR
    /// (<c>user:{userId}</c>) trafią powiadomienia o zadaniu.</summary>
    string? UserId { get; }

    /// <summary>Identyfikator klienta/połączenia, jeśli znany — pozwala odróżnić karty przeglądarki.</summary>
    string? ClientId { get; }

    /// <summary>Korelacja przenoszona do zdarzeń integracyjnych; pozwala klientowi
    /// rozpoznać echo własnej komendy i pozwala połączyć logi z kilku serwisów w jeden ślad.</summary>
    Guid CorrelationId { get; }

    /// <summary>
    /// Klucz idempotencji podany przez klienta w nagłówku <c>X-Request-Id</c>, jeśli podał.
    ///
    /// <para>Świadomie ODRĘBNY od <see cref="CorrelationId"/>, choć oba przychodzą nagłówkiem
    /// i oba identyfikują żądanie. Korelacja jest etykietą śladu — ma być inna przy każdej
    /// próbie, żeby dało się odróżnić powtórzenie od oryginału w logach. Klucz idempotencji
    /// jest odwrotnością: ma być TEN SAM przy ponowieniu, bo po nim serwer rozpoznaje,
    /// że tej operacji już nie należy wykonywać drugi raz. Jedno pole nie może mieć obu
    /// własności naraz.</para>
    ///
    /// <para>Puste przy wykonaniu w tle: zadanie masowe nie jest ponawiane przez klienta,
    /// a jego elementy mają własną ochronę przed powtórzeniem w <c>job_item.status</c>.</para>
    /// </summary>
    string? RequestId { get; }

    /// <summary>
    /// Efektywne kody uprawnień wołającego, dokładnie te, które <c>PermissionClaimsTransformation</c>
    /// dokłada do <c>ClaimsPrincipal</c> żądania (patrz <c>Erp.BuildingBlocks.Api.Auth</c>).
    ///
    /// <para>Istnieje po to, żeby reguła wsadowa (<c>IBatchRule&lt;T&gt;</c>) mogła sprawdzić
    /// dynamiczny <c>required_permission</c> zapisany na danych (np. na krawędzi przejścia
    /// automatu stanów w Task Management) — czego statyczny atrybut <c>Permissions(...)</c>
    /// endpointu nie umie, bo nie zna wymaganego kodu w chwili kompilacji. Sprawdzenie musi
    /// biec w pre-checku (żądanie HTTP), NIE w <c>BulkCommandRunner</c>: wykonanie chunka dzieje
    /// się później, w tle, bez ClaimsPrincipal — patrz <c>docs/backend/batch-validation.md</c>.</para>
    ///
    /// <para><b>Puste przy wykonaniu w tle</b>, z tego samego powodu co <see cref="RequestId"/>
    /// — <c>BulkCommandRunner</c> odtwarza kontekst zleceniodawcy z wiersza <c>job</c>, który nie
    /// niesie uprawnień. Handler komendy NIE ma więc jak dynamicznie sprawdzić uprawnienia do
    /// przejścia przy faktycznym wykonaniu — to świadoma granica tego mechanizmu, nie przeoczenie.</para>
    /// </summary>
    IReadOnlyCollection<string> Permissions { get; }
}

/// <summary>
/// Kontekst mutowalny w obrębie jednego scope'u DI. Ustawia go raz middleware HTTP
/// albo <c>BulkCommandRunner</c> przed wykonaniem chunka; reszta kodu widzi już tylko
/// interfejs <see cref="IExecutionContext"/> do odczytu.
/// </summary>
public sealed class MutableExecutionContext : IExecutionContext
{
    /// <inheritdoc />
    public string? UserId { get; private set; }

    /// <inheritdoc />
    public string? ClientId { get; private set; }

    /// <inheritdoc />
    public Guid CorrelationId { get; private set; } = Guid.CreateVersion7();

    /// <inheritdoc />
    public string? RequestId { get; private set; }

    /// <inheritdoc />
    public IReadOnlyCollection<string> Permissions { get; private set; } = [];

    /// <summary>Ustawia kontekst wykonania dla bieżącego scope'u.</summary>
    public void Set(
        string? userId,
        string? clientId,
        Guid? correlationId = null,
        string? requestId = null,
        IReadOnlyCollection<string>? permissions = null)
    {
        UserId = userId;
        ClientId = clientId;
        CorrelationId = correlationId ?? Guid.CreateVersion7();
        RequestId = requestId;
        Permissions = permissions ?? [];
    }
}
