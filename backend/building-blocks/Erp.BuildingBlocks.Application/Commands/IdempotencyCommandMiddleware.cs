using System.Text.Json;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Sprawia, że powtórzone żądanie z tym samym <c>X-Request-Id</c> nie wykonuje komendy drugi raz,
/// tylko oddaje wynik pierwszego wykonania.
///
/// <para><b>Czego to pilnuje.</b> Zapis przez HTTP nie ma bezpiecznego ponowienia: klient, który
/// nie doczekał odpowiedzi, nie wie, czy komenda się nie wykonała, czy wykonała i zginęła
/// odpowiedź. Bez klucza idempotencji jedyne, co może zrobić, to zgadywać — a przy operacjach
/// nieidempotentnych z natury (<c>exec</c>, <c>create</c> bez uuid od klienta) zgadywanie kończy
/// się drugim skutkiem, którego nikt nie zamawiał (patrz
/// <c>docs/backend/endpoint-naming.md</c> §4).</para>
///
/// <para><b>Bez nagłówka middleware nie robi nic.</b> Klucz podaje klient, bo tylko on wie,
/// które dwa żądania są tą samą operacją — dwa identyczne co do bajtu żądania mogą być
/// świadomym powtórzeniem (dwa razy „dodaj sztukę"), a serwer nie ma jak ich odróżnić od
/// ponowienia. Zgadywanie po treści komendy blokowałoby to pierwsze.</para>
///
/// <para><b>Siedzi WEWNĄTRZ jednostki pracy</b>, mimo że szkic w <c>cqrs.md</c> stawiał ją
/// przed nią. Powód jest rozstrzygający: klucz musi zostać zatwierdzony w tej samej transakcji
/// co skutek komendy. Zapisany osobno wcześniej — blokuje operację, która nigdy się nie wykonała
/// (bo handler rzucił); zapisany osobno później — zostawia okno, w którym powtórka zdąży wykonać
/// wszystko po raz drugi. Wewnątrz jednostki pracy oba przypadki znikają: klucz i skutek
/// są jednym commitem albo nie ma żadnego z nich.</para>
///
/// <para><b>Czego to nie łapie.</b> Dwóch RÓWNOLEGŁYCH żądań z tym samym kluczem — oba nie
/// widzą jeszcze cudzego wpisu, więc oba wykonają komendę, a przegrany rozbije się o unikalność
/// klucza przy zapisie i dostanie <c>409 request_duplicate</c> zamiast zapamiętanego wyniku.
/// Sekwencyjne ponowienie (czyli ten przypadek, dla którego to powstało) obsłużone jest w pełni.</para>
/// </summary>
public sealed partial class IdempotencyCommandMiddleware : ICommandMiddleware
{
    private readonly IIdempotencyStore _store;
    private readonly IExecutionContext _executionContext;
    private readonly ILogger<IdempotencyCommandMiddleware> _logger;

    public IdempotencyCommandMiddleware(
        IIdempotencyStore store,
        IExecutionContext executionContext,
        ILogger<IdempotencyCommandMiddleware> logger)
    {
        _store = store;
        _executionContext = executionContext;
        _logger = logger;
    }

    /// <summary>
    /// Klucz w rejestrze: identyfikator żądania, nazwa operacji i — jeśli komenda go niesie —
    /// identyfikator agregatu.
    ///
    /// <para><b>Nazwa operacji</b> jest w kluczu, bo jedno działanie użytkownika bywa kilkoma
    /// żądaniami pod rząd (rejestracja plików, a zaraz po niej dopięcie ich do produktów).
    /// Klient trzyma dla nich jeden identyfikator operacji, więc bez rozróżnienia po nazwie
    /// drugie żądanie dostałoby wynik pierwszego — cichy błąd zamiast ochrony.</para>
    ///
    /// <para><b>Identyfikator agregatu</b> jest w kluczu, bo jedno żądanie bywa paczką komend
    /// tego samego typu — <c>multimedia/create</c> rejestruje kilkanaście plików naraz,
    /// każdy własną komendą. Bez tego członu wszystkie dostałyby jeden klucz i już druga
    /// komenda paczki rozbiłaby się o duplikat, zanim cokolwiek zdążyłoby się zapisać.</para>
    ///
    /// <para>Komenda bez agregatu wykonana kilka razy w jednym żądaniu jest jedynym przypadkiem,
    /// którego ten klucz nie rozróżnia — i nie ma dziś takiego endpointu.</para>
    /// </summary>
    public static string BuildKey(string requestId, string operation, Guid? aggregateUuid = null)
        => aggregateUuid is null ? $"{requestId}:{operation}" : $"{requestId}:{operation}:{aggregateUuid}";

    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TCommand, TResult>(
        CommandInvocation<TCommand> invocation,
        CommandPipelineStep<TResult> continuation,
        CancellationToken cancellationToken)
        where TCommand : class
    {
        ArgumentNullException.ThrowIfNull(invocation);
        ArgumentNullException.ThrowIfNull(continuation);

        var requestId = _executionContext.RequestId;

        if (string.IsNullOrWhiteSpace(requestId))
        {
            return await continuation(cancellationToken).ConfigureAwait(false);
        }

        var key = BuildKey(requestId, invocation.CommandName, invocation.AggregateUuid);
        var recorded = await _store.FindAsync(key, cancellationToken).ConfigureAwait(false);

        if (recorded is not null)
        {
            LogReplayed(_logger, invocation.CommandName, requestId, _executionContext.CorrelationId);

            return recorded.ResultJson is null
                ? default!
                : JsonSerializer.Deserialize<TResult>(recorded.ResultJson)!;
        }

        var result = await continuation(cancellationToken).ConfigureAwait(false);

        _store.Stage(key, invocation.CommandName, _executionContext.UserId, JsonSerializer.Serialize(result));

        return result;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Powtórzone żądanie {CommandName} ({RequestId}) [{CorrelationId}] — oddaję zapamiętany wynik.")]
    private static partial void LogReplayed(
        ILogger logger, string commandName, string requestId, Guid correlationId);
}
