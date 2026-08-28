using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Validation;
using Shouldly;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Hierarchia i powiązania (<c>docs/backend/task-management.md</c> §8).
///
/// <para>Reguły cyklu testujemy na <b>atrapie zapytań grafu</b>, nie na bazie: sprawdzamy
/// symulację krawędzi z tego samego wsadu, czyli dokładnie tę część, której nie widzi ani
/// zapytanie do bazy, ani sprawdzenie w handlerze.</para>
/// </summary>
public class IssueGraphTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OtherProject = Guid.Parse("99999999-9999-9999-9999-999999999999");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);

    private static Issue Issue(Guid? projectUuid = null, string key = "DEV-1")
        => Domain.Issues.Issue.CreateWithUuid(
            Guid.CreateVersion7(),
            projectUuid ?? ProjectUuid,
            key,
            "Tytuł",
            WorkflowSchemeDefaults.Build(),
            Reporter,
            Now);

    [Fact]
    public void Zgloszenie_nie_moze_byc_swoim_rodzicem()
    {
        var issue = Issue();

        Should.Throw<DomainException>(() => issue.SetParent(issue, Now))
            .ErrorCode.ShouldBe("taskmgmt.parent_self");
    }

    /// <summary>Hierarchia nie przechodzi przez granicę projektu — przeniesienie rodzica
    /// przenosi dzieci (§8.3), więc drzewo rozpięte między projektami nigdy nie powstaje
    /// legalnie.</summary>
    [Fact]
    public void Rodzic_z_innego_projektu_jest_odrzucany()
    {
        var child = Issue();
        var parent = Issue(OtherProject, "MKT-1");

        Should.Throw<DomainException>(() => child.SetParent(parent, Now))
            .ErrorCode.ShouldBe("taskmgmt.parent_other_project");
    }

    [Fact]
    public void Zdjecie_rodzica_jest_dozwolone()
    {
        var child = Issue();
        var parent = Issue(key: "DEV-2");
        child.SetParent(parent, Now);

        child.SetParent(null, Now);

        child.ParentUuid.ShouldBeNull();
    }

    [Fact]
    public void Powiazanie_zgloszenia_z_samym_soba_jest_odrzucane()
    {
        var uuid = Guid.CreateVersion7();

        Should.Throw<DomainException>(() => IssueLink.CreateWithUuid(
                Guid.CreateVersion7(), uuid, uuid, IssueLinkType.Blocks, Reporter, Now))
            .ErrorCode.ShouldBe("taskmgmt.link_self");
    }

    /// <summary>
    /// Sedno reguły wsadowej: dwie krawędzie w JEDNYM zadaniu, z których każda osobno jest
    /// poprawna, a razem zamykają pętlę. Baza nie widzi żadnej z nich w chwili pre-checku,
    /// więc sprawdzenie „per element" przepuściłoby obie.
    /// </summary>
    [Fact]
    public async Task Dwie_krawedzie_z_tego_samego_wsadu_zamykajace_petle_odpadaja()
    {
        var a = Guid.CreateVersion7();
        var b = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueParentCycleRule(new EmptyGraph());

        await rule.ExecuteAsync(
            [new IssueParentTarget(a, b), new IssueParentTarget(b, a)],
            item => item.IssueUuid,
            tracker,
            CancellationToken.None);

        // Pierwsza krawędź przechodzi, druga zamyka pętlę.
        tracker.HasError(a).ShouldBeFalse();
        tracker.HasError(b).ShouldBeTrue();
    }

    [Fact]
    public async Task Blokada_zamykajaca_petle_wzgledem_bazy_odpada()
    {
        var a = Guid.CreateVersion7();
        var b = Guid.CreateVersion7();

        var tracker = new ValidationTracker();

        // Baza wie już, że B blokuje A. Dodanie „A blokuje B” zamyka pętlę.
        var rule = new IssueLinkCycleRule(new StubGraph(new() { [b] = [a] }));

        await rule.ExecuteAsync(
            [new IssueLinkTarget(a, b, IssueLinkType.Blocks)],
            item => item.SourceUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(a).ShouldBeTrue();
    }

    /// <summary>Pętla w „dotyczy” nie jest błędem: ten typ nie niesie kierunku wykonania,
    /// a odrzucanie jej byłoby wrogie (§8.2).</summary>
    [Fact]
    public async Task Petla_w_powiazaniu_innym_niz_blokada_jest_dozwolona()
    {
        var a = Guid.CreateVersion7();
        var b = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueLinkCycleRule(new StubGraph(new() { [b] = [a] }));

        await rule.ExecuteAsync(
            [new IssueLinkTarget(a, b, IssueLinkType.Relates)],
            item => item.SourceUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(a).ShouldBeFalse();
    }

    private sealed class EmptyGraph : StubGraph
    {
        public EmptyGraph() : base([])
        {
        }
    }

    private class StubGraph : IIssueGraphQueries
    {
        private readonly Dictionary<Guid, List<Guid>> _edges;

        public StubGraph(Dictionary<Guid, List<Guid>> edges) => _edges = edges;

        public Task<IssueGraphDto> GetGraphAsync(Guid issueUuid, CancellationToken cancellationToken)
            => Task.FromResult(new IssueGraphDto(issueUuid, null, [], []));

        public Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetAncestorsAsync(
            IReadOnlyCollection<Guid> issueUuids,
            CancellationToken cancellationToken)
            => Task.FromResult(Map());

        public Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetBlockingReachableAsync(
            IReadOnlyCollection<Guid> issueUuids,
            CancellationToken cancellationToken)
            => Task.FromResult(Map());

        public Task<IReadOnlyList<(Guid Uuid, int Level, Guid RootUuid)>> GetSubtreeAsync(
            IReadOnlyCollection<Guid> rootUuids,
            CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyList<(Guid, int, Guid)>>([]);

        private IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> Map()
            => _edges.ToDictionary(p => p.Key, p => (IReadOnlyList<Guid>)p.Value);
    }
}
