using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Seed;

/// <summary>
/// Dane startowe modułu: schemat systemowy stanów oraz dwa projekty przykładowe — jeden
/// <c>Delivery</c> (<c>DEV</c>) i jeden <c>Intake</c> (<c>MKT</c>).
///
/// <para><b>Schemat systemowy nie jest „danymi przykładowymi”</b> — bez niego nie da się założyć
/// żadnego projektu ani zgłoszenia, więc powstaje niezależnie od tego, czy seed przykładów jest
/// włączony. Rozdzielenie tych dwóch rzeczy jest celowe: na produkcji chcemy schematu, a nie
/// projektu „DEV” z dziesięcioma zmyślonymi zgłoszeniami.</para>
/// </summary>
public sealed partial class TaskManagementSeeder
{
    private static readonly (string Title, IssuePriority Priority, int StateStep)[] SeedIssues =
    [
        ("Skonfigurować środowisko deweloperskie", IssuePriority.High, 2),
        ("Poprawić walidację formularza logowania", IssuePriority.Normal, 1),
        ("Zaktualizować dokumentację API", IssuePriority.Low, 0),
        ("Zoptymalizować zapytanie listy produktów", IssuePriority.High, 1),
        ("Dodać eksport zgłoszeń do CSV", IssuePriority.Normal, 0),
        ("Naprawić literówkę w menu głównym", IssuePriority.Lowest, 2),
        ("Przygotować plan migracji bazy", IssuePriority.Critical, 1),
        ("Uporządkować kolejność kolumn na liście", IssuePriority.Low, 0),
    ];

    private static readonly (string Title, IssuePriority Priority, int StateStep)[] SeedRequests =
    [
        ("Zlecenie: landing page kampanii wiosennej", IssuePriority.High, 1),
        ("Zlecenie: integracja z systemem mailingowym", IssuePriority.Normal, 0),
        ("Zlecenie: raport sprzedaży za kwartał", IssuePriority.Normal, 0),
    ];

    private static readonly Guid DevProjectUuid = new("0198f000-0000-7000-8000-0000000000a1");
    private static readonly Guid MktProjectUuid = new("0198f000-0000-7000-8000-0000000000a2");

    private readonly TaskManagementDbContext _dbContext;
    private readonly TaskManagementSeedOptions _options;
    private readonly IClock _clock;
    private readonly ILogger<TaskManagementSeeder> _logger;

    public TaskManagementSeeder(
        TaskManagementDbContext dbContext,
        TaskManagementSeedOptions options,
        IClock clock,
        ILogger<TaskManagementSeeder> logger)
    {
        _dbContext = dbContext;
        _options = options;
        _clock = clock;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var scheme = await EnsureSystemSchemeAsync(cancellationToken).ConfigureAwait(false);

        if (!_options.Enabled)
        {
            return;
        }

        if (await _dbContext.Projects.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            LogSeedSkipped(_logger);
            return;
        }

        var now = _clock.UtcNow;
        var reporter = _options.LeadUserUuid ?? Guid.Empty;

        var dev = CreateProject(DevProjectUuid, "DEV", "Rozwój oprogramowania", ProjectKind.Delivery, scheme);
        var mkt = CreateProject(MktProjectUuid, "MKT", "Marketing — zlecenia", ProjectKind.Intake, scheme);

        var created = 0;
        created += AddIssues(dev, SeedIssues, scheme, reporter, now);
        created += AddIssues(mkt, SeedRequests, scheme, reporter, now);

        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogSeedCompleted(_logger, 2, created);
    }

    /// <summary>
    /// Schemat systemowy uzgadniany po stałym identyfikatorze, nie po nazwie — dokładnie jak
    /// katalog uprawnień w Identity. Istniejący zostaje nietknięty: nadpisywanie go przy każdym
    /// starcie kasowałoby zmiany wprowadzone edytorem z fazy 7.
    /// </summary>
    private async Task<WorkflowScheme> EnsureSystemSchemeAsync(CancellationToken cancellationToken)
    {
        var existing = await _dbContext.WorkflowSchemes
            .Include(s => s.States)
            .Include(s => s.Transitions)
            .FirstOrDefaultAsync(s => s.Uuid == WorkflowSchemeDefaults.SystemSchemeUuid, cancellationToken)
            .ConfigureAwait(false);

        if (existing is not null)
        {
            return existing;
        }

        var scheme = WorkflowSchemeDefaults.Build();
        _dbContext.WorkflowSchemes.Add(scheme);
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogSystemSchemeCreated(_logger, scheme.States.Count, scheme.Transitions.Count);

        return scheme;
    }

    private Project CreateProject(Guid uuid, string code, string name, ProjectKind kind, WorkflowScheme scheme)
    {
        // Projekty przykładowe są publiczne, bo inaczej pierwszy zalogowany użytkownik nie widzi
        // niczego i wygląda to na zepsutą listę, a nie na działający predykat widoczności.
        var project = Project.CreateWithUuid(uuid, code, name, kind, scheme.Uuid, isPublic: true);

        if (_options.LeadUserUuid is { } lead)
        {
            project.AddMember(lead, ProjectMemberRole.Lead);
        }

        _dbContext.Projects.Add(project);
        _dbContext.ProjectKeyCounters.Add(ProjectKeyCounter.Create(project.Uuid, project.Code));

        return project;
    }

    private int AddIssues(
        Project project,
        (string Title, IssuePriority Priority, int StateStep)[] definitions,
        WorkflowScheme scheme,
        Guid reporter,
        DateTimeOffset now)
    {
        var states = scheme.States.OrderBy(s => s.OrderNo).ToList();
        var number = 1;

        foreach (var (title, priority, stateStep) in definitions)
        {
            var issue = Issue.CreateWithUuid(
                Guid.CreateVersion7(),
                project.Uuid,
                $"{project.Code}-{number}",
                title,
                scheme,
                reporter,
                now);

            issue.SetPriority(priority, now);

            // Stan ustawiamy przez schemat, tą samą drogą co komenda — seed omijający regułę
            // przejścia produkowałby dane, których aplikacja nie umie wytworzyć, a to najgorszy
            // rodzaj danych testowych.
            issue.SetState(scheme, states[Math.Min(stateStep, states.Count - 1)].Uuid, now);

            _dbContext.Issues.Add(issue);
            number++;
        }

        // Licznik musi wskazywać PO ostatnim wykorzystanym numerze — inaczej pierwsze zgłoszenie
        // utworzone przez użytkownika dostanie klucz, który już istnieje.
        var counter = _dbContext.ProjectKeyCounters.Local.First(c => c.ProjectUuid == project.Uuid);
        _dbContext.Entry(counter).Property(nameof(ProjectKeyCounter.NextNumber)).CurrentValue = number;

        return definitions.Length;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Task Management zawiera już projekty — seed przykładów pominięty.")]
    private static partial void LogSeedSkipped(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Seed zakończony: {Projects} projektów, {Issues} zgłoszeń.")]
    private static partial void LogSeedCompleted(ILogger logger, int projects, int issues);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "Utworzono schemat systemowy: {States} stanów, {Transitions} przejść.")]
    private static partial void LogSystemSchemeCreated(ILogger logger, int states, int transitions);
}
