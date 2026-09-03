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
    /// Reguła automatyzacji, w imieniu której wykonuje się bieżąca komenda — <c>null</c> dla
    /// operacji zainicjowanej przez człowieka. Ustawiane przez silnik wykonawczy automatyzacji
    /// (<c>TaskManagement.Application.Automation.AutomationRuleEvaluator</c>) w nowym scope'ie
    /// DI per reguła, tym samym mechanizmem co odtworzenie tożsamości zleceniodawcy w
    /// <c>BulkCommandRunner</c>. Handlery komend czytają je, żeby oznaczyć efekt w historii
    /// zgłoszenia jako automatyczny (AUT-001 AC2), zamiast wstrzykiwać osobny, równoległy
    /// kontekst do kilkunastu miejsc, które i tak już znają <see cref="IExecutionContext"/>.
    /// </summary>
    Guid? AutomationRuleUuid { get; }

    /// <summary>Głębokość łańcucha automatyzacji, który doprowadził do bieżącej komendy — <c>0</c>
    /// dla operacji zainicjowanej przez człowieka, inaczej głębokość reguły-rodzica + 1. Kolejne
    /// zdarzenie triggerowane z wnętrza wykonania automatycznego niesie tę wartość dalej, żeby
    /// silnik mógł zatrzymać się na twardym limicie (AUT-001 AC3) zamiast zjeść instancję.</summary>
    int AutomationDepth { get; }
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
    public Guid? AutomationRuleUuid { get; private set; }

    /// <inheritdoc />
    public int AutomationDepth { get; private set; }

    /// <summary>Ustawia kontekst wykonania dla bieżącego scope'u.</summary>
    public void Set(string? userId, string? clientId, Guid? correlationId = null, string? requestId = null)
    {
        UserId = userId;
        ClientId = clientId;
        CorrelationId = correlationId ?? Guid.CreateVersion7();
        RequestId = requestId;
    }

    /// <summary>Znaczy bieżący scope jako wykonujący akcję reguły automatyzacji — wołane
    /// wyłącznie przez <c>AutomationRuleEvaluator</c>, w nowym scope'ie DI utworzonym per reguła
    /// (nigdy w scope'ie żądania HTTP).</summary>
    public void SetAutomation(Guid ruleUuid, int depth) => (AutomationRuleUuid, AutomationDepth) = (ruleUuid, depth);
}
