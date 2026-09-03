using Erp.BuildingBlocks.Application.Abstractions;
using Shouldly;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Tags;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Queries;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// SRCH-005 — rozwiązywanie DSL na <see cref="SearchIssueRequest"/>. AC2: DSL i formularz dają
/// identyczny obiekt filtra dla równoważnego zapytania; AC1: nieznane pole/wartość kończy się
/// błędem z pozycją w tekście.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class IssueSearchDslResolverTests
{
    private readonly PostgresFixture _postgres;

    public IssueSearchDslResolverTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Dsl_daje_ten_sam_obiekt_filtra_co_rownowazny_formularz()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);

        Guid projectUuid;
        Guid tagUuid;

        await using (var context = database.NewContext())
        {
            var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            scheme.AddState(Guid.CreateVersion7(), "todo", "state.todo", WorkflowStateCategory.Todo, 0);

            var typeScheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            typeScheme.AddType(Guid.CreateVersion7(), "task", "Zadanie", null, "list", IssueTypeCategory.Standard, 0);

            var project = Project.CreateWithUuid(
                Guid.CreateVersion7(), "DSL", "Jezyk zapytan", ProjectKind.Delivery, scheme.Uuid, typeScheme.Uuid, true);
            projectUuid = project.Uuid;

            var tag = Tag.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "Pilne", null);
            tagUuid = tag.Uuid;

            context.WorkflowSchemes.Add(scheme);
            context.IssueTypeSchemes.Add(typeScheme);
            context.Projects.Add(project);
            context.Tags.Add(tag);

            await context.SaveChangesAsync(ct);
        }

        var executionContext = new MutableExecutionContext();
        var me = Guid.CreateVersion7();
        executionContext.Set(me.ToString(), null);

        await using var readContext = database.NewContext();
        var resolver = new IssueSearchDslResolver(readContext, executionContext);

        var baseRequest = new SearchIssueRequest { Page = 2, PageSize = 25 };

        var resolved = await resolver.ResolveAsync(
            "project: DSL state: Done priority: High assignee: me tag: Pilne text: logowanie",
            baseRequest,
            ct);

        // Odpowiednik ręcznie zbudowanego żądania z formularza — te same pola, ten sam kształt.
        resolved.ProjectUuid.ShouldBe(projectUuid);
        resolved.StateCategory.ShouldBe(WorkflowStateCategory.Done);
        resolved.Priority.ShouldBe(IssuePriority.High);
        resolved.AssigneeUuid.ShouldBe(me);
        resolved.TagUuids.ShouldBe([tagUuid]);
        resolved.Text.ShouldBe("logowanie");

        // Paginacja z oryginalnego żądania przechodzi bez zmian — DSL jej nie niesie.
        resolved.Page.ShouldBe(2);
        resolved.PageSize.ShouldBe(25);
    }

    [Fact]
    public async Task Nieznane_pole_konczy_sie_bledem_z_pozycja()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);
        await using var context = database.NewContext();

        var resolver = new IssueSearchDslResolver(context, new MutableExecutionContext());

        var exception = await Should.ThrowAsync<IssueSearchDslParseException>(
            () => resolver.ResolveAsync("foo: bar", new SearchIssueRequest(), ct));

        exception.Position.ShouldBe(0);
        exception.ErrorCode.ShouldBe(IssueSearchDslParseException.Code);
    }

    [Fact]
    public async Task Nieznany_projekt_konczy_sie_bledem_z_pozycja()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);
        await using var context = database.NewContext();

        var resolver = new IssueSearchDslResolver(context, new MutableExecutionContext());

        var exception = await Should.ThrowAsync<IssueSearchDslParseException>(
            () => resolver.ResolveAsync("project: NIEISTNIEJE", new SearchIssueRequest(), ct));

        exception.Position.ShouldBe(0);
    }
}
