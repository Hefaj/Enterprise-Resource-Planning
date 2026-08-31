using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Validation;
using Shouldly;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// <c>required_permission</c> na krawędzi automatu (<c>docs/backend/task-management.md</c> §5.2) —
/// sprawdzany jako pre-check wsadowy, bo to jedyny moment, w którym wołający ma jeszcze
/// znane uprawnienia (patrz komentarz na <see cref="IssueTransitionPermissionRule"/>).
/// </summary>
public class IssueTransitionPermissionRuleTests
{
    private static readonly Guid ProjectUuid = Guid.CreateVersion7();
    private static readonly Guid TodoUuid = Guid.CreateVersion7();
    private static readonly Guid DoneUuid = Guid.CreateVersion7();
    private const string RequiredPermission = "taskmgmt.project.manage";

    private static WorkflowScheme SchemeWithGuardedTransition()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Test", isSystem: false);
        scheme.AddState(TodoUuid, "TODO", "state.todo", WorkflowStateCategory.Todo, 1);
        scheme.AddState(DoneUuid, "DONE", "state.done", WorkflowStateCategory.Done, 2);
        scheme.AddTransition(Guid.CreateVersion7(), TodoUuid, DoneUuid, "transition.done", RequiredPermission);
        return scheme;
    }

    private static BatchTarget<IssueSetStateCommand> Target(Guid issueUuid, Guid toStateUuid)
        => new(issueUuid, new IssueSetStateCommand { Uuid = issueUuid, StateUuid = toStateUuid });

    private static IssueDto Dto(Guid uuid, Guid stateUuid) => new(
        uuid, ProjectUuid, "DEV", "DEV-1", "Tytuł", null, IssuePriority.Normal,
        stateUuid, "TODO", "state.todo", WorkflowStateCategory.Todo, null,
        Guid.CreateVersion7(), null, null, null, false,
        DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, [], false);

    private sealed class StubIssueQueries : IIssueQueries
    {
        private readonly Dictionary<Guid, IssueDto> _issues;

        public StubIssueQueries(Dictionary<Guid, IssueDto> issues) => _issues = issues;

        public Task<List<IssueDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
            => Task.FromResult(_issues.Values.Where(i => uuids == null || uuids.Contains(i.Uuid)).ToList());

        public Task<SearchResponse> SearchAsync(SearchIssueRequest request, CancellationToken cancellationToken)
            => throw new NotSupportedException();

        public Task<IssueDto?> GetByKeyAsync(string key, CancellationToken cancellationToken)
            => throw new NotSupportedException();

        public Task<List<Guid>> GetMatchingUuidsAsync(SearchIssueRequest request, CancellationToken cancellationToken)
            => throw new NotSupportedException();
    }

    private sealed class StubSchemeRepository : IWorkflowSchemeRepository
    {
        private readonly WorkflowScheme _scheme;

        public StubSchemeRepository(WorkflowScheme scheme) => _scheme = scheme;

        public Task<WorkflowScheme?> FindAsync(Guid uuid, CancellationToken cancellationToken)
            => Task.FromResult<WorkflowScheme?>(_scheme);

        public Task<WorkflowScheme?> FindByProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
            => Task.FromResult<WorkflowScheme?>(_scheme);

        public void Add(WorkflowScheme scheme) => throw new NotSupportedException();
    }

    [Fact]
    public async Task Przejscie_bez_wymaganego_uprawnienia_odpada()
    {
        var issueUuid = Guid.CreateVersion7();
        var queries = new StubIssueQueries(new() { [issueUuid] = Dto(issueUuid, TodoUuid) });
        var executionContext = new MutableExecutionContext();
        executionContext.Set("user-1", null, permissions: []);

        var rule = new IssueTransitionPermissionRule(queries, new StubSchemeRepository(SchemeWithGuardedTransition()), executionContext);
        var tracker = new ValidationTracker();

        await rule.ExecuteAsync([Target(issueUuid, DoneUuid)], t => t.AggregateUuid, tracker, CancellationToken.None);

        tracker.HasError(issueUuid).ShouldBeTrue();
        tracker.Errors[issueUuid][0].ErrorCode.ShouldBe("taskmgmt.transition_forbidden");
    }

    [Fact]
    public async Task Przejscie_z_wymaganym_uprawnieniem_przechodzi()
    {
        var issueUuid = Guid.CreateVersion7();
        var queries = new StubIssueQueries(new() { [issueUuid] = Dto(issueUuid, TodoUuid) });
        var executionContext = new MutableExecutionContext();
        executionContext.Set("user-1", null, permissions: [RequiredPermission]);

        var rule = new IssueTransitionPermissionRule(queries, new StubSchemeRepository(SchemeWithGuardedTransition()), executionContext);
        var tracker = new ValidationTracker();

        await rule.ExecuteAsync([Target(issueUuid, DoneUuid)], t => t.AggregateUuid, tracker, CancellationToken.None);

        tracker.HasError(issueUuid).ShouldBeFalse();
    }

    [Fact]
    public async Task Przejscie_bez_wymogu_w_schemacie_nie_jest_blokowane()
    {
        var issueUuid = Guid.CreateVersion7();
        // Cel wskazuje stan, dla którego schemat nie zna żadnej krawędzi z TODO — istnienie
        // krawędzi sprawdza handler (`taskmgmt.transition_not_allowed`), nie ta reguła.
        var otherState = Guid.CreateVersion7();
        var queries = new StubIssueQueries(new() { [issueUuid] = Dto(issueUuid, TodoUuid) });
        var executionContext = new MutableExecutionContext();
        executionContext.Set("user-1", null, permissions: []);

        var rule = new IssueTransitionPermissionRule(queries, new StubSchemeRepository(SchemeWithGuardedTransition()), executionContext);
        var tracker = new ValidationTracker();

        await rule.ExecuteAsync([Target(issueUuid, otherState)], t => t.AggregateUuid, tracker, CancellationToken.None);

        tracker.HasError(issueUuid).ShouldBeFalse();
    }
}
