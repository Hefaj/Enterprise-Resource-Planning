using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.Queries;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Integracyjne kryteria akceptacji fazy 4: rekurencyjne CTE muszą działać na prawdziwym
/// Postgresie, a pasek hierarchii nie może omijać predykatu widoczności zgłoszeń.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class TaskManagementGraphQueriesTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 28, 12, 0, 0, TimeSpan.Zero);

    private readonly PostgresFixture _postgres;

    public TaskManagementGraphQueriesTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Rekurencyjne_cte_zwracaja_przodkow_poddrzewo_i_osiagalne_blokady()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await _postgres.CreateDatabaseAsync("taskmgmt_graph", cancellationToken);
        var viewer = Guid.CreateVersion7();

        var (root, child, grandchild) = await SeedTreeAsync(connectionString, viewer, cancellationToken);

        await using var context = NewContext(connectionString);
        await AssertGraphQueryTablesAreNotPersistedAsync(context, cancellationToken);
        var queries = NewQueries(context, viewer);

        var ancestors = await queries.GetAncestorsAsync([grandchild], cancellationToken);
        ancestors[grandchild].ShouldBe([child, root]);

        var reachable = await queries.GetBlockingReachableAsync([root], cancellationToken);
        reachable[root].ShouldBe([child, grandchild]);

        var subtree = await queries.GetSubtreeAsync([root], cancellationToken);
        subtree.ShouldBe([
            (root, 0, root),
            (child, 1, root),
            (grandchild, 2, root),
        ]);
    }

    [Fact]
    public async Task Graf_nie_ujawnia_restricted_rodzica_ani_dziecka()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await _postgres.CreateDatabaseAsync("taskmgmt_visibility", cancellationToken);
        var viewer = Guid.CreateVersion7();
        var owner = Guid.CreateVersion7();

        var scheme = WorkflowSchemeDefaults.Build();
        var project = Project.CreateWithUuid(
            Guid.CreateVersion7(),
            "DEV",
            "Projekt testowy",
            ProjectKind.Delivery,
            scheme.Uuid,
            isPublic: false);
        project.AddMember(viewer, ProjectMemberRole.Contributor);

        var restrictedParent = NewIssue(project.Uuid, "DEV-1", owner, scheme);
        restrictedParent.SetRestricted(true, Now);

        var visible = NewIssue(project.Uuid, "DEV-2", viewer, scheme);
        visible.SetParent(restrictedParent, Now);

        var restrictedChild = NewIssue(project.Uuid, "DEV-3", owner, scheme);
        restrictedChild.SetRestricted(true, Now);
        restrictedChild.SetParent(visible, Now);

        await using (var setup = NewContext(connectionString))
        {
            await setup.Database.MigrateAsync(cancellationToken);
            setup.WorkflowSchemes.Add(scheme);
            setup.Projects.Add(project);
            setup.Issues.AddRange(restrictedParent, visible, restrictedChild);
            await setup.SaveChangesAsync(cancellationToken);
        }

        await using var context = NewContext(connectionString);
        var graph = await NewQueries(context, viewer).GetGraphAsync(visible.Uuid, cancellationToken);

        graph.Parent.ShouldBeNull();
        graph.Children.ShouldBeEmpty();
        graph.Links.ShouldBeEmpty();
    }

    private static async Task<(Guid Root, Guid Child, Guid Grandchild)> SeedTreeAsync(
        string connectionString,
        Guid viewer,
        CancellationToken cancellationToken)
    {
        var scheme = WorkflowSchemeDefaults.Build();
        var project = Project.CreateWithUuid(
            Guid.CreateVersion7(),
            "DEV",
            "Projekt testowy",
            ProjectKind.Delivery,
            scheme.Uuid,
            isPublic: false);
        project.AddMember(viewer, ProjectMemberRole.Contributor);

        var root = NewIssue(project.Uuid, "DEV-1", viewer, scheme);
        var child = NewIssue(project.Uuid, "DEV-2", viewer, scheme);
        child.SetParent(root, Now);
        var grandchild = NewIssue(project.Uuid, "DEV-3", viewer, scheme);
        grandchild.SetParent(child, Now);

        var rootBlocksChild = IssueLink.CreateWithUuid(
            Guid.CreateVersion7(), root.Uuid, child.Uuid, IssueLinkType.Blocks, viewer, Now);
        var childBlocksGrandchild = IssueLink.CreateWithUuid(
            Guid.CreateVersion7(), child.Uuid, grandchild.Uuid, IssueLinkType.Blocks, viewer, Now);

        await using var context = NewContext(connectionString);
        await context.Database.MigrateAsync(cancellationToken);
        context.WorkflowSchemes.Add(scheme);
        context.Projects.Add(project);
        context.Issues.AddRange(root, child, grandchild);
        context.IssueLinks.AddRange(rootBlocksChild, childBlocksGrandchild);
        await context.SaveChangesAsync(cancellationToken);

        return (root.Uuid, child.Uuid, grandchild.Uuid);
    }

    private static Issue NewIssue(Guid projectUuid, string key, Guid reporter, WorkflowScheme scheme)
        => Issue.CreateWithUuid(
            Guid.CreateVersion7(),
            projectUuid,
            key,
            key,
            scheme,
            reporter,
            Now);

    private static IssueGraphQueries NewQueries(TaskManagementDbContext context, Guid userUuid)
    {
        var executionContext = new MutableExecutionContext();
        executionContext.Set(userUuid.ToString(), clientId: null);
        return new IssueGraphQueries(context, executionContext);
    }

    private static TaskManagementDbContext NewContext(string connectionString)
    {
        var builder = new DbContextOptionsBuilder<TaskManagementDbContext>();
        builder.UseErpPostgres(
            connectionString,
            TaskManagementDbContext.SchemaName,
            typeof(TaskManagementDbContext).Assembly.GetName().Name);

        return new TaskManagementDbContext(builder.Options);
    }

    /// <summary>
    /// Rekordy wynikowe CTE są typami CLR dla <c>SqlQuery&lt;T&gt;</c>, nie tabelami. Ten test
    /// chroni migrację przed ponownym potraktowaniem ich jak encji przy zmianie modelu EF.
    /// </summary>
    private static async Task AssertGraphQueryTablesAreNotPersistedAsync(
        TaskManagementDbContext context,
        CancellationToken cancellationToken)
    {
        await context.Database.OpenConnectionAsync(cancellationToken);

        try
        {
            await using var command = context.Database.GetDbConnection().CreateCommand();
            command.CommandText =
                "select to_regclass('taskmgmt.graph_edge_row'), to_regclass('taskmgmt.subtree_row');";

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            (await reader.ReadAsync(cancellationToken)).ShouldBeTrue();
            reader.IsDBNull(0).ShouldBeTrue();
            reader.IsDBNull(1).ShouldBeTrue();
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }
}
