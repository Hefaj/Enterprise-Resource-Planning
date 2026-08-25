using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace Erp.ArchitectureTests;

/// <summary>
/// Pilnuje zachowań pipeline'u komend, których nie widać w sygnaturach: kolejności ogniw,
/// tego KTO zatwierdza transakcję i tego, że powtórzone żądanie nie wykonuje komendy drugi raz.
///
/// Każdy z tych trzech punktów psuje się cicho. Przestawiona kolejność ogniw nie wywala
/// niczego — po prostu klucz idempotencji przestaje być w jednej transakcji ze skutkiem.
/// Zgubione przejęcie granicy transakcji nie wywala niczego — chunk zadania masowego zaczyna
/// się zapisywać po elemencie. Stąd testy, a nie komentarz.
/// </summary>
public class CommandPipelineTests
{
    private static ServiceProvider BuildProvider(
        FakeUnitOfWork unitOfWork,
        FakeIdempotencyStore idempotency,
        MutableExecutionContext executionContext,
        Action<IServiceCollection>? configure = null)
    {
        var services = new ServiceCollection();

        services.AddSingleton<IUnitOfWork>(unitOfWork);
        services.AddSingleton<IIdempotencyStore>(idempotency);
        services.AddSingleton<IExecutionContext>(executionContext);
        services.AddSingleton(NullLoggerFactory.Instance);
        services.AddLogging();

        services.AddScoped<CommandTransactionScope>();
        services.AddScoped<ICommandDispatcher, CommandDispatcher>();
        services.AddScoped<ICommandMiddleware, LoggingCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, ValidationCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, UnitOfWorkCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, IdempotencyCommandMiddleware>();

        services.AddScoped<ICommandHandler<PipelineCommand, Guid>, PipelineCommandHandler>();

        configure?.Invoke(services);

        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task Komenda_zatwierdza_jednostke_pracy_raz()
    {
        var unitOfWork = new FakeUnitOfWork();
        var provider = BuildProvider(unitOfWork, new FakeIdempotencyStore(), new MutableExecutionContext());

        var uuid = Guid.CreateVersion7();
        var result = await provider.GetRequiredService<ICommandDispatcher>()
            .SendAsync<PipelineCommand, Guid>(new PipelineCommand { Uuid = uuid }, TestContext.Current.CancellationToken);

        result.ShouldBe(uuid);
        unitOfWork.SaveCount.ShouldBe(1);
    }

    /// <summary>
    /// Przejęcie granicy przez wywołującego (paczka multimediów, chunk zadania masowego)
    /// wyłącza zatwierdzanie po każdej komendzie — na tym stoi „wszystko albo nic".
    /// </summary>
    [Fact]
    public async Task Przejeta_granica_transakcji_wstrzymuje_zatwierdzanie()
    {
        var unitOfWork = new FakeUnitOfWork();
        var provider = BuildProvider(unitOfWork, new FakeIdempotencyStore(), new MutableExecutionContext());
        var dispatcher = provider.GetRequiredService<ICommandDispatcher>();

        using (dispatcher.OwnTransaction())
        {
            await dispatcher.SendAsync<PipelineCommand, Guid>(new PipelineCommand(), TestContext.Current.CancellationToken);
            await dispatcher.SendAsync<PipelineCommand, Guid>(new PipelineCommand(), TestContext.Current.CancellationToken);
        }

        unitOfWork.SaveCount.ShouldBe(0);

        // Po zwolnieniu tokenu kolejna komenda znów jest właścicielem własnej transakcji.
        await dispatcher.SendAsync<PipelineCommand, Guid>(new PipelineCommand(), TestContext.Current.CancellationToken);
        unitOfWork.SaveCount.ShouldBe(1);
    }

    [Fact]
    public async Task Wyjatek_handlera_nie_zatwierdza_niczego()
    {
        var unitOfWork = new FakeUnitOfWork();
        var provider = BuildProvider(unitOfWork, new FakeIdempotencyStore(), new MutableExecutionContext());

        await Should.ThrowAsync<DomainException>(() => provider.GetRequiredService<ICommandDispatcher>()
            .SendAsync<PipelineCommand, Guid>(
                new PipelineCommand { Fail = true },
                TestContext.Current.CancellationToken));

        unitOfWork.SaveCount.ShouldBe(0);
    }

    /// <summary>
    /// Bez nagłówka <c>X-Request-Id</c> mechanizm jest bezczynny — inaczej wykonanie w tle
    /// (gdzie klucza nigdy nie ma) zaczęłoby zapisywać wpisy bez żadnego nabywcy.
    /// </summary>
    [Fact]
    public async Task Bez_klucza_zadania_idempotencja_nic_nie_zapisuje()
    {
        var idempotency = new FakeIdempotencyStore();
        var provider = BuildProvider(new FakeUnitOfWork(), idempotency, new MutableExecutionContext());

        await provider.GetRequiredService<ICommandDispatcher>()
            .SendAsync<PipelineCommand, Guid>(new PipelineCommand(), TestContext.Current.CancellationToken);

        idempotency.Staged.ShouldBeEmpty();
    }

    [Fact]
    public async Task Powtorzone_zadanie_oddaje_zapamietany_wynik_bez_wykonania_handlera()
    {
        var idempotency = new FakeIdempotencyStore();
        var executionContext = new MutableExecutionContext();
        executionContext.Set(userId: "u1", clientId: null, correlationId: null, requestId: "req-1");

        var provider = BuildProvider(new FakeUnitOfWork(), idempotency, executionContext);
        var dispatcher = provider.GetRequiredService<ICommandDispatcher>();

        // Licznik jest statyczny (handler powstaje w kontenerze), więc test zaczyna od zera.
        PipelineCommandHandler.Executions = 0;

        var command = new PipelineCommand { Uuid = Guid.CreateVersion7() };

        var first = await dispatcher.SendAsync<PipelineCommand, Guid>(command, TestContext.Current.CancellationToken);
        idempotency.Commit();

        var second = await dispatcher.SendAsync<PipelineCommand, Guid>(command, TestContext.Current.CancellationToken);

        second.ShouldBe(first);
        PipelineCommandHandler.Executions.ShouldBe(1, "handler nie powinien wykonać się drugi raz");
    }

    /// <summary>
    /// Paczka komend tego samego typu w JEDNYM żądaniu (rejestracja kilkunastu plików) musi
    /// dostać różne klucze — inaczej druga komenda paczki rozbija się o duplikat.
    /// </summary>
    [Fact]
    public void Klucz_idempotencji_rozroznia_komendy_paczki_po_agregacie()
    {
        var first = IdempotencyCommandMiddleware.BuildKey("req-1", "MultimediaCreateCommand", Guid.CreateVersion7());
        var second = IdempotencyCommandMiddleware.BuildKey("req-1", "MultimediaCreateCommand", Guid.CreateVersion7());

        first.ShouldNotBe(second);
    }

    /// <summary>
    /// Odrzucenie przez walidator MUSI być <see cref="DomainException"/> — po tym typie
    /// <c>BulkCommandRunner</c> rozpoznaje element do odrzucenia. Wyjątek spoza tej gałęzi
    /// wywracałby transakcję całego chunka z powodu jednego źle wypełnionego pola.
    /// </summary>
    [Fact]
    public async Task Walidacja_odrzuca_komende_przed_handlerem_i_jest_bledem_domenowym()
    {
        PipelineCommandHandler.Executions = 0;

        var unitOfWork = new FakeUnitOfWork();
        var provider = BuildProvider(
            unitOfWork,
            new FakeIdempotencyStore(),
            new MutableExecutionContext(),
            services => services.AddScoped<IValidator<PipelineCommand>, PipelineCommandValidator>());

        var exception = await Should.ThrowAsync<CommandValidationException>(() =>
            provider.GetRequiredService<ICommandDispatcher>().SendAsync<PipelineCommand, Guid>(
                new PipelineCommand { Amount = -5 },
                TestContext.Current.CancellationToken));

        exception.ShouldBeAssignableTo<DomainException>();
        exception.Failures.ShouldContain(f => f.ErrorCode == "amount_negative");
        PipelineCommandHandler.Executions.ShouldBe(0);
        unitOfWork.SaveCount.ShouldBe(0);
    }
}

#pragma warning disable CA1812 // Typy wzorcowe są instancjonowane przez kontener w testach.

internal sealed class PipelineCommand : IAggregateCommand, ICommand<Guid>
{
    public Guid Uuid { get; set; }

    public decimal Amount { get; set; }

    public bool Fail { get; set; }
}

internal sealed class PipelineCommandHandler : ICommandHandler<PipelineCommand, Guid>
{
    internal static int Executions;

    public Task<Guid> ExecuteAsync(PipelineCommand command, CancellationToken ct = default)
    {
        Executions++;

        return command.Fail
            ? throw new DomainException("pipeline_failed", "Celowa porażka.")
            : Task.FromResult(command.Uuid);
    }
}

internal sealed class PipelineCommandValidator : AbstractValidator<PipelineCommand>
{
    public PipelineCommandValidator()
        => RuleFor(c => c.Amount).GreaterThanOrEqualTo(0).WithErrorCode("amount_negative");
}

/// <summary>Liczy zatwierdzenia — pipeline nie ma innego obserwowalnego skutku.</summary>
internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCount { get; private set; }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SaveCount++;
        return Task.CompletedTask;
    }
}

/// <summary>
/// Rejestr w pamięci z ODDZIELONYM zatwierdzeniem — <see cref="Stage"/> nic nie udostępnia,
/// dopóki nie zawoła się <see cref="Commit"/>. Tak zachowuje się prawdziwy magazyn wpięty
/// w jednostkę pracy i tylko dzięki temu test widzi różnicę między „zapisano" a „dołożono
/// do transakcji".
/// </summary>
internal sealed class FakeIdempotencyStore : IIdempotencyStore
{
    private readonly Dictionary<string, IdempotentOperation> _committed = [];

    public List<IdempotentOperation> Staged { get; } = [];

    public Task<IdempotentOperation?> FindAsync(string key, CancellationToken cancellationToken)
        => Task.FromResult(_committed.TryGetValue(key, out var record) ? record : null);

    public void Stage(string key, string operation, string? userId, string? resultJson)
        => Staged.Add(new IdempotentOperation(key, operation, resultJson));

    public void Commit()
    {
        foreach (var record in Staged)
        {
            _committed[record.Key] = record;
        }

        Staged.Clear();
    }
}

#pragma warning restore CA1812
