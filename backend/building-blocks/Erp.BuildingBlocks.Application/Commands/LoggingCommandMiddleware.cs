using System.Diagnostics;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using Microsoft.Extensions.Logging;

namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Zapisuje w logu każdą komendę: co, kto, w ramach jakiej korelacji, jak długo i z jakim skutkiem.
///
/// <para><b>Najbardziej zewnętrzne ogniwo</b>, bo ma objąć również odrzucenie przez walidację
/// i replay idempotencji — zdarzenia, które kończą się bez wykonania handlera. Log, który
/// pokazuje wyłącznie komendy, które doszły do handlera, milczy dokładnie o tych przypadkach,
/// dla których się do niego zagląda.</para>
///
/// <para><b>Naruszenie reguły domenowej to <c>Warning</c>, a nie <c>Error</c>.</b> Odrzucenie
/// ujemnej ceny jest normalną pracą systemu — gdyby szło jako błąd, przy operacjach masowych
/// zalałoby log dziesiątkami tysięcy wpisów o awarii, której nie ma. Na <c>Error</c> zostaje
/// to, czego nikt nie przewidział.</para>
///
/// <para>Wpisy idą przez generator źródeł (<see cref="LoggerMessageAttribute"/>): brak boksowania
/// argumentów i brak formatowania, gdy poziom jest wyłączony — przy 50 tys. komend na zadanie
/// to nie jest mikrooptymalizacja.</para>
/// </summary>
public sealed partial class LoggingCommandMiddleware : ICommandMiddleware
{
    private readonly IExecutionContext _executionContext;
    private readonly ILogger<LoggingCommandMiddleware> _logger;

    public LoggingCommandMiddleware(IExecutionContext executionContext, ILogger<LoggingCommandMiddleware> logger)
    {
        _executionContext = executionContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TCommand, TResult>(
        CommandInvocation<TCommand> invocation,
        CommandPipelineStep<TResult> continuation,
        CancellationToken cancellationToken)
        where TCommand : class
    {
        ArgumentNullException.ThrowIfNull(invocation);
        ArgumentNullException.ThrowIfNull(continuation);

        var startedAt = Stopwatch.GetTimestamp();

        try
        {
            var result = await continuation(cancellationToken).ConfigureAwait(false);

            // Jawny warunek, bo pomiar czasu jest argumentem wyliczanym: przy wyłączonym
            // poziomie generator i tak by go policzył, a komend bywa 50 tys. na zadanie.
            if (_logger.IsEnabled(LogLevel.Information))
            {
                var elapsedMs = Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds;

                LogSucceeded(
                    _logger,
                    invocation.CommandName,
                    invocation.AggregateUuid,
                    _executionContext.UserId,
                    _executionContext.CorrelationId,
                    elapsedMs);
            }

            return result;
        }
        catch (DomainException ex)
        {
            LogRejected(
                _logger,
                invocation.CommandName,
                invocation.AggregateUuid,
                ex.ErrorCode,
                _executionContext.CorrelationId,
                ex.Message);

            throw;
        }
#pragma warning disable CA1031 // Wyjątek jest logowany i przekazywany dalej, nie połykany.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            LogFailed(
                _logger,
                invocation.CommandName,
                invocation.AggregateUuid,
                _executionContext.CorrelationId,
                ex);

            throw;
        }
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Komenda {CommandName} ({AggregateUuid}) wykonana przez {UserId} [{CorrelationId}] w {ElapsedMs} ms.")]
    private static partial void LogSucceeded(
        ILogger logger, string commandName, Guid? aggregateUuid, string? userId, Guid correlationId, double elapsedMs);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning,
        Message = "Komenda {CommandName} ({AggregateUuid}) odrzucona: {ErrorCode} [{CorrelationId}] — {Reason}")]
    private static partial void LogRejected(
        ILogger logger, string commandName, Guid? aggregateUuid, string errorCode, Guid correlationId, string reason);

    [LoggerMessage(EventId = 3, Level = LogLevel.Error,
        Message = "Komenda {CommandName} ({AggregateUuid}) zakończona błędem [{CorrelationId}].")]
    private static partial void LogFailed(
        ILogger logger, string commandName, Guid? aggregateUuid, Guid correlationId, Exception exception);
}
