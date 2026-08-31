using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Infrastructure.Persistence.Graph;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Infrastructure.Persistence;

/// <summary>
/// Kontekst modułu Task Management, schemat <c>taskmgmt</c>.
///
/// <para>Prefiks techniczny to <b>taskmgmt</b>, nie <c>task</c>: <c>job</c>/<c>notification.job</c>
/// zajmują już pole semantyczne „zadanie” i przy czytaniu logów nie dałoby się ich rozróżnić
/// (<c>docs/backend/task-management.md</c> §2).</para>
///
/// <para><see cref="IJobDbContext"/> jest tu od fazy 0, choć operacje masowe wchodzą dopiero
/// w fazie 6 — dołożenie go później oznaczałoby osobną migrację na dwie tabele, których kształt
/// jest z góry znany.</para>
/// </summary>
public sealed class TaskManagementDbContext : ErpDbContext, IJobDbContext
{
    /// <summary>Nazwa schematu modułu.</summary>
    public const string SchemaName = "taskmgmt";

    public TaskManagementDbContext(DbContextOptions<TaskManagementDbContext> options) : base(options)
    {
    }

    /// <inheritdoc />
    protected override string Schema => SchemaName;

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();

    public DbSet<ProjectKeyCounter> ProjectKeyCounters => Set<ProjectKeyCounter>();

    public DbSet<Issue> Issues => Set<Issue>();

    public DbSet<Board> Boards => Set<Board>();

    public DbSet<BoardColumn> BoardColumns => Set<BoardColumn>();

    /// <summary>Kolejność kart na tablicach. Wiersz powstaje przy pierwszym przestawieniu
    /// karty, nie przy założeniu zgłoszenia (<c>docs/backend/task-management.md</c> §7.1).</summary>
    public DbSet<BoardCard> BoardCards => Set<BoardCard>();

    public DbSet<IssueAttachment> IssueAttachments => Set<IssueAttachment>();

    public DbSet<IssueComment> IssueComments => Set<IssueComment>();

    /// <summary>Krawędzie grafu powiązań. Hierarchia (<c>issue.parent_uuid</c>) mieszka OSOBNO
    /// i to jest celowe — rodzic ma inne reguły niż link
    /// (<c>docs/backend/task-management.md</c> §8.1).</summary>
    public DbSet<IssueLink> IssueLinks => Set<IssueLink>();

    /// <summary>Historia zmian zgłoszeń — tylko do dopisywania i do czytania w karcie.</summary>
    public DbSet<IssueActivity> IssueActivities => Set<IssueActivity>();

    public DbSet<FieldScheme> FieldSchemes => Set<FieldScheme>();

    public DbSet<FieldDefinition> FieldDefinitions => Set<FieldDefinition>();

    public DbSet<WorkflowScheme> WorkflowSchemes => Set<WorkflowScheme>();

    public DbSet<WorkflowState> WorkflowStates => Set<WorkflowState>();

    public DbSet<WorkflowTransition> WorkflowTransitions => Set<WorkflowTransition>();

    public DbSet<IssueTypeScheme> IssueTypeSchemes => Set<IssueTypeScheme>();

    public DbSet<IssueType> IssueTypes => Set<IssueType>();

    /// <inheritdoc />
    public DbSet<Job> Jobs => Set<Job>();

    /// <inheritdoc />
    public DbSet<JobItem> JobItems => Set<JobItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TaskManagementDbContext).Assembly);

        // Typy bezkluczowe pod wyniki rekurencyjnych CTE — bez tabeli i bez śladu w migracjach.
        modelBuilder.Entity<GraphEdgeRow>().HasNoKey().ToView(null);
        modelBuilder.Entity<SubtreeRow>().HasNoKey().ToView(null);

        modelBuilder.ApplyConfiguration(new JobConfiguration());
        modelBuilder.ApplyConfiguration(new JobItemConfiguration());

        base.OnModelCreating(modelBuilder);
    }
}
