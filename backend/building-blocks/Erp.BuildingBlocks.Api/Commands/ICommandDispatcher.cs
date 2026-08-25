using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Commands;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Api.Commands;

/// <summary>
/// Jedyne wejście do wykonania komendy. Rozwiązuje handler i przepuszcza wywołanie przez
/// pipeline (<see cref="ICommandMiddleware"/>).
///
/// <para><b>Dlaczego nie <c>command.ExecuteAsync(ct)</c> z FastEndpoints.</b> Rozszerzenie szyny
/// komend rozwiązuje handler z rejestru FastEndpoints i <i>root</i> providera, więc poza żądaniem
/// HTTP nie ma z czego wstrzyknąć niczego scoped (dokładnie ten błąd wyłożył pierwszą wersję
/// operacji masowych — patrz <c>BulkCommandExecutor</c>). Nie ma też żadnego miejsca, w którym
/// dałoby się wpiąć logowanie, walidację, idempotencję czy granicę transakcji: FastEndpoints
/// w tej wersji nie ma pipeline'u komend. Ten dyspozytor jest tym miejscem.</para>
///
/// <para><b>Dwa parametry typowe zamiast jednego</b> — <c>SendAsync&lt;ProductSetPriceCommand,
/// Guid&gt;(cmd, ct)</c>. C# nie wywnioskuje <c>TResult</c> z ograniczenia
/// <c>ICommand&lt;TResult&gt;</c>, a alternatywą byłoby rozwiązywanie handlera refleksją przy
/// każdym wywołaniu. Przy dyspozycji per element zadania masowego (50 tys. razy na zadanie)
/// jawność wygrywa z krótszym wywołaniem.</para>
/// </summary>
public interface ICommandDispatcher
{
    /// <summary>Wykonuje komendę przez pełny pipeline.</summary>
    Task<TResult> SendAsync<TCommand, TResult>(TCommand command, CancellationToken cancellationToken)
        where TCommand : class, ICommand<TResult>;

    /// <summary>
    /// Przejmuje granicę transakcji na czas życia zwróconego tokenu: komendy wykonane w środku
    /// nie zatwierdzają zmian same, robi to wywołujący. Dla paczki komend, która ma się zapisać
    /// w całości albo wcale.
    /// </summary>
    IDisposable OwnTransaction();
}

/// <inheritdoc />
public sealed class CommandDispatcher : ICommandDispatcher
{
    private readonly IServiceProvider _services;
    private readonly IReadOnlyList<ICommandMiddleware> _middlewares;
    private readonly CommandTransactionScope _transactionScope;

    /// <param name="services">Scope DI bieżącego żądania albo chunka zadania.</param>
    /// <param name="middlewares">Ogniwa pipeline'u W KOLEJNOŚCI REJESTRACJI — pierwsze
    /// zarejestrowane jest najbardziej zewnętrzne.</param>
    /// <param name="transactionScope">Stan właścicielstwa transakcji dla tego scope'u.</param>
    public CommandDispatcher(
        IServiceProvider services,
        IEnumerable<ICommandMiddleware> middlewares,
        CommandTransactionScope transactionScope)
    {
        ArgumentNullException.ThrowIfNull(middlewares);

        _services = services;
        _middlewares = [.. middlewares];
        _transactionScope = transactionScope;
    }

    /// <inheritdoc />
    public IDisposable OwnTransaction() => _transactionScope.Claim();

    /// <inheritdoc />
    public Task<TResult> SendAsync<TCommand, TResult>(TCommand command, CancellationToken cancellationToken)
        where TCommand : class, ICommand<TResult>
    {
        ArgumentNullException.ThrowIfNull(command);

        // Handler spod ZAMKNIĘTEGO interfejsu, z bieżącego scope'u — ten sam wpis, który
        // zakłada AddErpModule i z którego korzysta BulkCommandExecutor. Dzięki temu handler
        // dostaje DbContext tej samej jednostki pracy, co reszta wywołania.
        var handler = _services.GetRequiredService<ICommandHandler<TCommand, TResult>>();

        var invocation = new CommandInvocation<TCommand>(
            command,
            typeof(TCommand).Name,
            command is IAggregateCommand aggregateCommand ? aggregateCommand.Uuid : null);

        CommandPipelineStep<TResult> next = token => handler.ExecuteAsync(command, token);

        // Składanie od końca: ostatnie zarejestrowane ogniwo owija handler, pierwsze
        // owija wszystko pozostałe.
        for (var i = _middlewares.Count - 1; i >= 0; i--)
        {
            var middleware = _middlewares[i];
            var inner = next;
            next = token => middleware.InvokeAsync<TCommand, TResult>(invocation, inner, token);
        }

        return next(cancellationToken);
    }
}
