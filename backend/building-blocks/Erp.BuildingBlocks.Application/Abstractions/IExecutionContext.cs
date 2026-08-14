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

    /// <summary>Ustawia kontekst wykonania dla bieżącego scope'u.</summary>
    public void Set(string? userId, string? clientId, Guid? correlationId = null)
    {
        UserId = userId;
        ClientId = clientId;
        CorrelationId = correlationId ?? Guid.CreateVersion7();
    }
}
