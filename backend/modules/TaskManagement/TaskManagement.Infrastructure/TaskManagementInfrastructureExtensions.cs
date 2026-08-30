using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Sprints;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Jobs;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.Seed;

namespace TaskManagement.Infrastructure;

/// <summary>
/// Rejestracja warstwy infrastruktury modułu Task Management — ten sam kształt, co w Catalogu,
/// Identity i Sales. Repozytoria i zapytania wyłapuje skan zestawów w <c>AddErpModule</c>
/// po konwencji nazewniczej (<c>IIssueQueries</c> → <c>IssueQueries</c>), więc nowa komenda ani
/// nowe repozytorium <b>nie dopisują tu niczego</b>.
/// </summary>
public static class TaskManagementInfrastructureExtensions
{
    /// <summary>Nazwa wpisu z łańcuchem połączenia w sekcji <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "TaskManagementDb";

    public static IServiceCollection AddTaskManagementInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Brak łańcucha połączenia `ConnectionStrings:{ConnectionStringName}` w konfiguracji.");

        services.AddDbContext<TaskManagementDbContext>(options => options.UseErpPostgres(
            connectionString,
            TaskManagementDbContext.SchemaName,
            typeof(TaskManagementDbContext).Assembly.GetName().Name));

        // Dzierżawa wyłączności idzie razem z kontekstem — korzysta z niej seed, a od fazy 2
        // także rebalans rangi kart na tablicy (docs/backend/multi-instance.md §3.1).
        services.AddErpExclusiveLease<TaskManagementDbContext>();

        services.Configure<IssueAttachmentOptions>(configuration.GetSection(IssueAttachmentOptions.SectionName));

        services.AddScoped<TaskManagementSeeder>();

        var seedOptions = configuration.GetSection(TaskManagementSeedOptions.SectionName)
            .Get<TaskManagementSeedOptions>() ?? new TaskManagementSeedOptions();
        services.AddSingleton(seedOptions);

        // Kolejność ma znaczenie: hosted service'y startują sekwencyjnie, więc migracja MUSI być
        // zarejestrowana przed seedem.
        services.AddHostedService<ErpDatabaseMigrator<TaskManagementDbContext>>();
        services.AddHostedService<TaskManagementSeedInitializer>();

        // Rebalans rangi kart — rzadki, pod dzierżawą, patrz BoardRankRebalanceService.
        services.AddHostedService<BoardRankRebalanceService>();
        services.AddHostedService<SlaEscalationService>();

        // Sygnatury SignalR — kontrakt z frontendem. Muszą zgadzać się co do znaku
        // z `signalrSignature` orkiestratorów (docs/backend/realtime-signalr.md).
        services.AddSingleton<IAggregateSignatureMap>(new AggregateSignatureMap()
            .Register<Issue>(AggregateSignatures.TaskManagementIssue)
            .Register<Project>(AggregateSignatures.TaskManagementProject)
            .Register<WorkflowScheme>(AggregateSignatures.TaskManagementWorkflowScheme)
            .Register<IssueAttachment>(AggregateSignatures.TaskManagementIssueAttachment)
            .Register<IssueComment>(AggregateSignatures.TaskManagementIssueComment)
            .Register<IssueLink>(AggregateSignatures.TaskManagementIssueLink)
            .Register<FieldScheme>(AggregateSignatures.TaskManagementFieldScheme)
            .Register<Board>(AggregateSignatures.TaskManagementBoard)
            .Register<Sprint>(AggregateSignatures.TaskManagementSprint)

            // Karta jest osobnym korzeniem agregatu na TYM SAMYM kanale, co tablica: dzięki
            // temu przeciągnięcie rozgłasza uuid karty, a nie uuid tablicy, czyli nie każe
            // wszystkim klientom przeładować kilkuset kart (§7.4). Klient dostaje jednym
            // kanałem oba rodzaje uuid-ów i odpytuje o nie ten sam endpoint — uuid tablicy
            // nie pasuje wtedy do żadnej karty i nic nie zmienia.
            .Register<BoardCard>(AggregateSignatures.TaskManagementBoard));

        // `IssueActivity` świadomie NIE ma sygnatury: historia zmienia się wyłącznie razem
        // ze zgłoszeniem albo komentarzem, a te mają własne kanały. Osobny kanał oznaczałby
        // dwa zdarzenia realtime na jedną zmianę i drugie odświeżenie karty bez nowej treści.

        return services;
    }
}
