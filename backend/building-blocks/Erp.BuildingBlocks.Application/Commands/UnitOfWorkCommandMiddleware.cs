using Erp.BuildingBlocks.Application.Abstractions;

namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Zatwierdza jednostkę pracy po komendzie, która jest właścicielem transakcji.
///
/// <para><b>Co to zmienia w handlerach.</b> Nic — i o to chodzi. Handler nadal nie woła
/// <c>SaveChanges</c> (patrz <c>docs/backend/cqrs.md</c> §3), zmienia się tylko to, że granicę
/// wyznacza teraz pipeline, a nie każdy wywołujący z osobna. Endpoint pojedynczej komendy nie
/// musi już pamiętać o zapisie — a to jest błąd, którego kompilator nie łapie i który kończy
/// się odpowiedzią „200 OK" bez żadnej zmiany w bazie.</para>
///
/// <para><b>Kto zatwierdza, rozstrzyga <see cref="CommandTransactionScope"/></b>: wywołanie
/// zagnieżdżone nie zatwierdza nic, a wywołujący, który przejął granicę (paczka multimediów,
/// chunk zadania masowego), zatwierdza sam, gdy uzna paczkę za kompletną.</para>
///
/// <para><b>Wyjątek nie zatwierdza niczego</b> — brak <c>try/catch</c> jest tu celowy.
/// Naruszenie reguły domenowej zostawia kontekst czysty (metoda agregatu waliduje przed zmianą
/// stanu), więc w zadaniu masowym pozostałe elementy chunka nadal mogą się zapisać.</para>
/// </summary>
public sealed class UnitOfWorkCommandMiddleware : ICommandMiddleware
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly CommandTransactionScope _scope;

    public UnitOfWorkCommandMiddleware(IUnitOfWork unitOfWork, CommandTransactionScope scope)
    {
        _unitOfWork = unitOfWork;
        _scope = scope;
    }

    /// <inheritdoc />
    public async Task<TResult> InvokeAsync<TCommand, TResult>(
        CommandInvocation<TCommand> invocation,
        CommandPipelineStep<TResult> continuation,
        CancellationToken cancellationToken)
        where TCommand : class
    {
        ArgumentNullException.ThrowIfNull(continuation);

        using var boundary = _scope.Enter();

        var result = await continuation(cancellationToken).ConfigureAwait(false);

        if (boundary.OwnsCommit)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return result;
    }
}
