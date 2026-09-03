using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Rozwiązuje pary <c>pole: wartość</c> z <see cref="IssueSearchDslParser"/> na
/// <see cref="SearchIssueRequest"/> — w Infrastructure, bo <c>project</c> i <c>tag</c> wymagają
/// odczytu z bazy (kod → uuid). Zarejestrowany automatycznie przez skan zestawów w
/// <c>AddErpModule</c> (<see cref="IIssueSearchDslResolver"/> → ta klasa), tak jak
/// <see cref="IssueQueries"/>.
/// </summary>
public sealed class IssueSearchDslResolver : IIssueSearchDslResolver
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueSearchDslResolver(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<SearchIssueRequest> ResolveAsync(
        string dsl, SearchIssueRequest baseRequest, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dsl);
        ArgumentNullException.ThrowIfNull(baseRequest);

        var pairs = IssueSearchDslParser.Parse(dsl);

        var resolved = Clone(baseRequest);
        var tagUuids = new List<Guid>();

        // `project:` musi rozwiązać się PRZED `tag:`, żeby tag mógł zawęzić wyszukiwanie do
        // tagów tego projektu — kolejność w pętli jest kolejnością wystąpienia w tekście, więc
        // DSL, w którym `tag:` poprzedza `project:`, szuka tagu wyłącznie wśród globalnych.
        foreach (var pair in pairs)
        {
            switch (pair.Field.ToLowerInvariant())
            {
                case "project":
                    resolved.ProjectUuid = await ResolveProjectAsync(pair, cancellationToken).ConfigureAwait(false);
                    break;

                case "state":
                    resolved.StateCategory = ResolveStateCategory(pair);
                    break;

                case "priority":
                    resolved.Priority = ResolvePriority(pair);
                    break;

                case "assignee":
                    resolved.AssigneeUuid = ResolveAssignee(pair);
                    break;

                case "tag":
                    tagUuids.Add(await ResolveTagAsync(pair, resolved.ProjectUuid, cancellationToken).ConfigureAwait(false));
                    break;

                case "text":
                    resolved.Text = pair.Value;
                    break;

                default:
                    throw new IssueSearchDslParseException($"Nieznane pole `{pair.Field}`.", pair.Position);
            }
        }

        if (tagUuids.Count > 0)
        {
            resolved.TagUuids = tagUuids;
        }

        return resolved;
    }

    private async Task<Guid> ResolveProjectAsync(IssueSearchDslPair pair, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => EF.Functions.ILike(p.Code, pair.Value))
            .Select(p => new { p.Uuid })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (project is null)
        {
            throw new IssueSearchDslParseException($"Nieznany projekt `{pair.Value}`.", pair.Position);
        }

        return project.Uuid;
    }

    private static WorkflowStateCategory ResolveStateCategory(IssueSearchDslPair pair) => pair.Value.ToLowerInvariant() switch
    {
        "todo" or "open" => WorkflowStateCategory.Todo,
        "inprogress" or "in-progress" or "doing" => WorkflowStateCategory.InProgress,
        "done" or "closed" => WorkflowStateCategory.Done,
        _ => throw new IssueSearchDslParseException(
            $"Nieznana kategoria stanu `{pair.Value}` (dozwolone: todo, open, inprogress, in-progress, doing, done, closed).",
            pair.Position),
    };

    private static IssuePriority ResolvePriority(IssueSearchDslPair pair)
        => Enum.TryParse<IssuePriority>(pair.Value, ignoreCase: true, out var priority)
            ? priority
            : throw new IssueSearchDslParseException($"Nieznany priorytet `{pair.Value}`.", pair.Position);

    private Guid ResolveAssignee(IssueSearchDslPair pair)
    {
        if (string.Equals(pair.Value, "me", StringComparison.OrdinalIgnoreCase))
        {
            return IssueVisibility.CurrentUser(_executionContext);
        }

        if (Guid.TryParse(pair.Value, out var uuid))
        {
            return uuid;
        }

        throw new IssueSearchDslParseException(
            $"Nieznana wartość `{pair.Value}` dla `assignee` (dozwolone: `me` albo uuid użytkownika).",
            pair.Position);
    }

    private async Task<Guid> ResolveTagAsync(IssueSearchDslPair pair, Guid? projectUuid, CancellationToken cancellationToken)
    {
        var tag = await _dbContext.Tags
            .AsNoTracking()
            .Where(t => EF.Functions.ILike(t.Name, pair.Value) && (t.ProjectUuid == null || t.ProjectUuid == projectUuid))
            .Select(t => new { t.Uuid })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (tag is null)
        {
            throw new IssueSearchDslParseException($"Nieznany tag `{pair.Value}`.", pair.Position);
        }

        return tag.Uuid;
    }

    private static SearchIssueRequest Clone(SearchIssueRequest source) => new()
    {
        Scope = source.Scope,
        ProjectUuid = source.ProjectUuid,
        Text = source.Text,
        StateUuid = source.StateUuid,
        StateCategory = source.StateCategory,
        Priority = source.Priority,
        AssigneeUuid = source.AssigneeUuid,
        CustomFields = source.CustomFields,
        TagUuids = source.TagUuids,
        TreeMode = source.TreeMode,
        Dsl = null,
        Page = source.Page,
        PageSize = source.PageSize,
        Sorts = source.Sorts,
    };
}
