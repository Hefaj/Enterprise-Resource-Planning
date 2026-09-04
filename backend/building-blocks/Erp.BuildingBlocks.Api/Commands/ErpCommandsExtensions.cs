using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Erp.BuildingBlocks.Persistence.Idempotency;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Erp.BuildingBlocks.Api.Commands;

/// <summary>
/// Rejestruje pipeline komend modułu.
///
/// <para><b>Dlaczego to osobne wywołanie, a nie część <c>AddErpApi</c>.</b> Rejestr idempotencji
/// mieszka w schemacie modułu, więc trzeba wskazać JEGO <c>DbContext</c> — a <c>AddErpApi</c>
/// jest z założenia bezstanowe wobec persystencji i wołane przez serwisy, zanim ich kontekst
/// w ogóle jest zarejestrowany. Ta jedna linijka w <c>Program.cs</c> niesie decyzję („klucze
/// idempotencji dla tego serwisu leżą tutaj"), a nie mechaniczne powtórzenie — dokładnie tak,
/// jak <c>AddErpBulkJobs&lt;TContext&gt;</c> obok.</para>
/// </summary>
public static class ErpCommandsExtensions
{
    /// <summary>Rejestruje dyspozytora, ogniwa pipeline'u i rejestr idempotencji.</summary>
    /// <typeparam name="TContext">Kontekst modułu — w jego schemacie leży tabela
    /// <c>idempotency_key</c>.</typeparam>
    /// <param name="services">Kolekcja usług.</param>
    /// <param name="configuration">Konfiguracja hosta; sekcja
    /// <see cref="CommandPipelineOptions.SectionName"/>.</param>
    public static IServiceCollection AddErpCommands<TContext>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TContext : ErpDbContext
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<CommandPipelineOptions>(configuration.GetSection(CommandPipelineOptions.SectionName));

        services.TryAddScoped<CommandTransactionScope>();
        services.TryAddScoped<ICommandDispatcher, CommandDispatcher>();
        services.TryAddScoped<IIdempotencyStore, EfIdempotencyStore<TContext>>();

        // Dzierżawa wyłączności — usługi tła i praca startowa modułu (patrz
        // docs/architecture/multi-instance.md §3.1). TryAdd, więc moduł, który zarejestrował ją już
        // przy swoim DbContekście (a robią tak wszystkie, bo migrator startuje przed komendami),
        // nie dostaje drugiego wpisu.
        services.AddErpExclusiveLease<TContext>();

        // ── KOLEJNOŚĆ OGNIW ─────────────────────────────────────────────────────────────────
        //
        // Rejestracja = kolejność wykonania, pierwsze jest najbardziej zewnętrzne. Każdy z tych
        // czterech wierszy stoi tu, gdzie stoi, z powodu, którego nie da się odwrócić:
        //
        //  1. Logowanie — na zewnątrz wszystkiego, bo ma objąć również komendy odrzucone przez
        //     walidację i powtórki oddane z rejestru idempotencji. To są dokładnie te zdarzenia,
        //     dla których zagląda się do logu.
        //  2. Walidacja — przed czymkolwiek, co dotyka bazy. Komenda z ujemną ceną nie ma po co
        //     otwierać transakcji ani rezerwować klucza idempotencji.
        //  3. Jednostka pracy — wyznacza transakcję.
        //  4. Idempotencja — WEWNĄTRZ jednostki pracy, choć szkic w cqrs.md stawiał ją przed nią.
        //     Klucz musi zostać zatwierdzony tym samym commitem co skutek komendy: zapisany
        //     wcześniej osobno blokuje operację, która nigdy się nie wykonała, zapisany później
        //     zostawia okno na drugie wykonanie. Ta zamiana jest jedynym odstępstwem od szkicu.
        //
        // Enumerable, nie TryAdd: to jest ŁAŃCUCH, a nie usługa z jedną implementacją.
        services.AddScoped<ICommandMiddleware, LoggingCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, ValidationCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, UnitOfWorkCommandMiddleware>();
        services.AddScoped<ICommandMiddleware, IdempotencyCommandMiddleware>();

        services.AddHostedService<IdempotencyCleanupService<TContext>>();

        return services;
    }
}
