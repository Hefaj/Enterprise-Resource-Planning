namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Jedno wywołanie komendy w drodze przez pipeline — komenda razem z tym, co da się o niej
/// powiedzieć bez znajomości jej typu.
///
/// <para>Middleware jest generyczne po <typeparamref name="TCommand"/>, więc samą komendę widzi
/// w pełni typowaną; <see cref="AggregateUuid"/> jest tu dlatego, że rozpoznanie komendy
/// agregatowej (<c>IAggregateCommand</c>) należy do warstwy Api, a log i idempotencja żyją
/// w Application i nie mogą jej referencować. Dyspozytor wypełnia to pole raz, przy wejściu
/// do pipeline'u, zamiast każdego middleware'u sięgającego po refleksję.</para>
/// </summary>
/// <param name="Command">Komenda przekazywana do handlera.</param>
/// <param name="CommandName">Nazwa typu komendy — ta sama, którą <c>job.command_type</c> zapisuje
/// dla operacji masowych, więc log HTTP i log zadania da się połączyć po jednej wartości.</param>
/// <param name="AggregateUuid">Identyfikator agregatu, jeśli komenda go niesie.</param>
public sealed record CommandInvocation<TCommand>(TCommand Command, string CommandName, Guid? AggregateUuid)
    where TCommand : class;

/// <summary>Kolejny krok pipeline'u — ostatnim jest wywołanie handlera komendy.</summary>
public delegate Task<TResult> CommandPipelineStep<TResult>(CancellationToken cancellationToken);

/// <summary>
/// Ogniwo pipeline'u komend: warstwa, przez którą przechodzi KAŻDA komenda, niezależnie od tego,
/// czy przyszła żądaniem HTTP, czy jest elementem zadania masowego.
///
/// <para><b>Po co to w ogóle jest.</b> Logowanie, walidacja wejścia, idempotencja i granica
/// transakcji to cztery rzeczy, o których dotąd musiał pamiętać autor każdego handlera
/// i endpointu — a raczej: o których pamiętać nie musiał, bo nic mu o nich nie przypominało.
/// Handler, który zapomniał <c>SaveChanges</c>, kończył się cichym „udało się", po którym
/// w bazie nie było nic.</para>
///
/// <para><b>Kolejność ogniw to kolejność rejestracji</b> w kontenerze (patrz
/// <c>AddErpCommands</c>) — pierwsze zarejestrowane jest najbardziej zewnętrzne. Nie jest
/// dowolna i jest opisana tam, gdzie zapada: logowanie musi objąć wszystko (łącznie z odrzuceniem
/// przez walidację), a klucz idempotencji musi trafić do TEJ SAMEJ transakcji co skutek,
/// który odtwarza — więc siedzi WEWNĄTRZ jednostki pracy.</para>
///
/// <para>Middleware nie ma prawa połknąć wyjątku domenowego: na <see cref="Domain.DomainException"/>
/// stoi zarówno mapowanie na <c>ProblemDetails</c>, jak i częściowy sukces operacji masowej
/// (<c>BulkCommandRunner</c> po nim rozpoznaje element do odrzucenia, a nie awarię chunka).</para>
/// </summary>
public interface ICommandMiddleware
{
    /// <summary>Przetwarza wywołanie i oddaje sterowanie kolejnemu ogniwu przez <paramref name="continuation"/>.</summary>
    Task<TResult> InvokeAsync<TCommand, TResult>(
        CommandInvocation<TCommand> invocation,
        CommandPipelineStep<TResult> continuation,
        CancellationToken cancellationToken)
        where TCommand : class;
}
