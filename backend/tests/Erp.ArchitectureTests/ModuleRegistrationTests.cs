using Erp.BuildingBlocks.Api;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Xunit;

namespace Erp.ArchitectureTests;

/// <summary>
/// Pilnuje konwencji, na których stoi <see cref="ErpModuleRegistrationExtensions.AddErpModule"/>.
///
/// Skanowanie zestawu zdejmuje z <c>Program.cs</c> klasę błędu „zapomniałem wpisu", ale wprowadza
/// nową: „klasa przestała pasować do konwencji". Ta druga jest cichsza od pierwszej — brakujący
/// egzekutor wychodzi dopiero, gdy runner sięgnie po niego w środku zadania masowego. Stąd te
/// testy: opisują konwencje na wzorcowych typach, więc zmiana reguł skanera wywala build,
/// a nie produkcję.
/// </summary>
public class ModuleRegistrationTests
{
    private static ServiceCollection Scan()
    {
        var services = new ServiceCollection();
        services.AddErpModule(typeof(ModuleRegistrationTests).Assembly);
        return services;
    }

    [Fact]
    public void Handler_komendy_rejestruje_sie_pod_zamknietym_interfejsem()
    {
        var services = Scan();

        var descriptor = services.SingleOrDefault(d =>
            d.ServiceType == typeof(ICommandHandler<SampleAggregateCommand, Guid>));

        descriptor.ShouldNotBeNull();
        descriptor.ImplementationType.ShouldBe(typeof(SampleAggregateCommandHandler));
        descriptor.Lifetime.ShouldBe(ServiceLifetime.Scoped);
    }

    /// <summary>
    /// Egzekutor musi wisieć pod KLUCZEM równym nazwie typu komendy — to po niej
    /// <see cref="BulkCommandRunner{TContext}"/> odnajduje go dla zadania odczytanego z bazy
    /// (<c>job.command_type</c>). Rozjazd tutaj oznacza zadanie masowe, którego nie da się wykonać.
    /// </summary>
    [Fact]
    public void Komenda_agregatowa_z_handlerem_dostaje_egzekutora_pod_kluczem()
    {
        var services = Scan();

        var descriptor = services.SingleOrDefault(d =>
            d.ServiceType == typeof(IBulkCommandExecutor)
            && (d.ServiceKey as string) == nameof(SampleAggregateCommand));

        descriptor.ShouldNotBeNull();
        descriptor.KeyedImplementationType.ShouldBe(typeof(BulkCommandExecutor<SampleAggregateCommand>));
    }

    /// <summary>
    /// Komenda bez <see cref="IAggregateCommand"/> nie ma czego wczytać z bazy dla elementu
    /// zadania, więc egzekutor byłby wpisem, który wybucha dopiero przy rozwiązywaniu.
    /// </summary>
    [Fact]
    public void Komenda_nieagregatowa_nie_dostaje_egzekutora()
    {
        var services = Scan();

        services.ShouldNotContain(d =>
            d.ServiceType == typeof(IBulkCommandExecutor)
            && (d.ServiceKey as string) == nameof(SamplePlainCommand));
    }

    [Fact]
    public void Reguly_i_walidatory_wsadowe_rejestruja_sie_pod_wlasnym_typem()
    {
        var services = Scan();

        services.ShouldContain(d => d.ServiceType == typeof(SampleBatchRule));
        services.ShouldContain(d => d.ServiceType == typeof(SampleBatchValidator));
    }

    /// <summary>
    /// Walidator wejścia komendy musi wisieć pod zamkniętym <c>IValidator&lt;TCommand&gt;</c> —
    /// pod tym typem szuka go <c>ValidationCommandMiddleware</c>. Rejestracja pod własnym typem
    /// (jak reguły wsadowe) sprawiłaby, że walidator istnieje, a pipeline go nie widzi.
    /// </summary>
    [Fact]
    public void Walidator_komendy_rejestruje_sie_pod_zamknietym_interfejsem()
    {
        var services = Scan();

        var descriptor = services.SingleOrDefault(d =>
            d.ServiceType == typeof(IValidator<SampleAggregateCommand>));

        descriptor.ShouldNotBeNull();
        descriptor.ImplementationType.ShouldBe(typeof(SampleAggregateCommandValidator));
        descriptor.Lifetime.ShouldBe(ServiceLifetime.Scoped);
    }

    [Fact]
    public void Implementacja_nazwana_po_interfejsie_rejestruje_sie_pod_nim()
    {
        var services = Scan();

        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(ISampleQueries));

        descriptor.ShouldNotBeNull();
        descriptor.ImplementationType.ShouldBe(typeof(SampleQueries));
    }

    /// <summary>
    /// Konwencja dopasowuje wyłącznie interfejs o dokładnie tej nazwie. Gdyby brała „pierwszy
    /// lepszy", klasa implementująca przy okazji <c>IDisposable</c> albo <c>IHostedService</c>
    /// wjechałaby do kontenera pod obcym kontraktem.
    /// </summary>
    [Fact]
    public void Konwencja_nie_lapie_interfejsu_o_innej_nazwie()
    {
        var services = Scan();

        services.ShouldNotContain(d => d.ServiceType == typeof(IUnrelatedContract));
    }

    /// <summary>
    /// Wcześniejsza rejestracja jawna wygrywa z konwencją (<c>TryAdd</c>) — to jest furtka dla
    /// klas wymagających innego cyklu życia niż scoped.
    /// </summary>
    [Fact]
    public void Jawna_rejestracja_ma_pierwszenstwo_przed_konwencja()
    {
        var services = new ServiceCollection();
        services.AddSingleton<ISampleQueries, SampleQueries>();

        services.AddErpModule(typeof(ModuleRegistrationTests).Assembly);

        var descriptors = services.Where(d => d.ServiceType == typeof(ISampleQueries)).ToList();
        descriptors.Count.ShouldBe(1);
        descriptors[0].Lifetime.ShouldBe(ServiceLifetime.Singleton);
    }
}

#pragma warning disable CA1812 // Typy wzorcowe są instancjonowane wyłącznie przez skaner w testach.

internal sealed class SampleAggregateCommand : IAggregateCommand, ICommand<Guid>
{
    public Guid Uuid { get; set; }
}

internal sealed class SampleAggregateCommandHandler : ICommandHandler<SampleAggregateCommand, Guid>
{
    public Task<Guid> ExecuteAsync(SampleAggregateCommand command, CancellationToken ct = default)
        => Task.FromResult(command.Uuid);
}

internal sealed class SampleAggregateCommandValidator : AbstractValidator<SampleAggregateCommand>
{
    public SampleAggregateCommandValidator() => RuleFor(c => c.Uuid).NotEmpty();
}

internal sealed class SamplePlainCommand : ICommand<Guid>;

internal sealed class SamplePlainCommandHandler : ICommandHandler<SamplePlainCommand, Guid>
{
    public Task<Guid> ExecuteAsync(SamplePlainCommand command, CancellationToken ct = default)
        => Task.FromResult(Guid.Empty);
}

internal sealed class SampleBatchRule : IBatchRule<Guid>
{
    public Task ExecuteAsync(
        IReadOnlyList<Guid> items,
        Func<Guid, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
        => Task.CompletedTask;
}

internal sealed class SampleBatchValidator : IBatchValidator;

internal interface ISampleQueries;

internal interface IUnrelatedContract;

internal sealed class SampleQueries : ISampleQueries, IUnrelatedContract;

#pragma warning restore CA1812
