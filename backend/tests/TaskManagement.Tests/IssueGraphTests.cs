using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Validation;
using Shouldly;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.IssueTypes;
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
            IssueTypeSchemeDefaults.Build().DefaultType(),
            Reporter,
            Now);

    [Fact]
    public void Zgloszenie_nie_moze_byc_swoim_rodzicem()
    {
        var issue = Issue();

        Should.Throw<DomainException>(() => issue.SetParent(issue, IssueTypeCategory.Standard, IssueTypeCategory.Standard, Now))
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

        Should.Throw<DomainException>(() => child.SetParent(parent, IssueTypeCategory.Standard, IssueTypeCategory.Standard, Now))
            .ErrorCode.ShouldBe("taskmgmt.parent_other_project");
    }

    [Fact]
    public void Zdjecie_rodzica_jest_dozwolone()
    {
        var child = Issue();
        var parent = Issue(key: "DEV-2");
        child.SetParent(parent, IssueTypeCategory.Standard, IssueTypeCategory.Standard, Now);

        child.SetParent(null, IssueTypeCategory.Standard, null, Now);

        child.ParentUuid.ShouldBeNull();
    }

    /// <summary>LNK-001 AC2: epik nie może mieć rodzica. Sprawdzamy też, że odrzucenie nie
    /// zmienia stanu agregatu — reguła „metoda agregatu waliduje PRZED zmianą stanu”, na której
    /// stoi częściowy sukces operacji masowych (<c>docs/backend/cqrs.md</c> §3).</summary>
    [Fact]
    public void Epik_nie_moze_miec_rodzica()
    {
        var epic = Issue();
        var parent = Issue(key: "DEV-2");
        var originalParent = epic.ParentUuid;

        Should.Throw<DomainException>(() => epic.SetParent(parent, IssueTypeCategory.Epic, IssueTypeCategory.Standard, Now))
            .ErrorCode.ShouldBe("taskmgmt.parent_epic_cannot_have_parent");

        epic.ParentUuid.ShouldBe(originalParent);
    }

    /// <summary>LNK-001 AC2: podzadanie nie może być rodzicem. Tak samo sprawdzamy, że
    /// odrzucenie zostawia rodzica dziecka niezmienionym.</summary>
    [Fact]
    public void Podzadanie_nie_moze_byc_rodzicem()
    {
        var child = Issue();
        var subtaskParent = Issue(key: "DEV-2");
        var originalParent = child.ParentUuid;

        Should.Throw<DomainException>(() => child.SetParent(subtaskParent, IssueTypeCategory.Standard, IssueTypeCategory.Subtask, Now))
            .ErrorCode.ShouldBe("taskmgmt.parent_subtask_cannot_be_parent");

        child.ParentUuid.ShouldBe(originalParent);
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

    /// <summary>
    /// Sedno pre-checku kategorii: element odrzucony na tej regule dostaje status <c>Failed</c>
    /// razem z kodem błędu <b>przy tworzeniu zadania</b> — bez sięgania po <c>BulkCommandRunner</c>
    /// (`docs/backend/batch-validation.md` §1). Testujemy samą regułę na atrapie zapytania grafu,
    /// dokładnie tak jak <see cref="IssueParentCycleRule"/> obok.
    /// </summary>
    [Fact]
    public async Task Epik_w_wsadzie_odpada_na_precheku_kategorii()
    {
        var epic = Guid.CreateVersion7();
        var parent = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueParentCategoryRule(new StubGraph([], new()
        {
            [epic] = IssueTypeCategory.Epic,
            [parent] = IssueTypeCategory.Standard,
        }));

        await rule.ExecuteAsync(
            [new IssueParentTarget(epic, parent)],
            item => item.IssueUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(epic).ShouldBeTrue();
        tracker.Errors[epic].ShouldContain(e => e.ErrorCode == "taskmgmt.parent_epic_cannot_have_parent");
    }

    [Fact]
    public async Task Podzadanie_jako_docelowy_rodzic_odpada_na_precheku_kategorii()
    {
        var child = Guid.CreateVersion7();
        var subtaskParent = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueParentCategoryRule(new StubGraph([], new()
        {
            [child] = IssueTypeCategory.Standard,
            [subtaskParent] = IssueTypeCategory.Subtask,
        }));

        await rule.ExecuteAsync(
            [new IssueParentTarget(child, subtaskParent)],
            item => item.IssueUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(child).ShouldBeTrue();
        tracker.Errors[child].ShouldContain(e => e.ErrorCode == "taskmgmt.parent_subtask_cannot_be_parent");
    }

    [Fact]
    public async Task Standardowa_para_przechodzi_precheck_kategorii()
    {
        var child = Guid.CreateVersion7();
        var parent = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueParentCategoryRule(new StubGraph([], new()
        {
            [child] = IssueTypeCategory.Standard,
            [parent] = IssueTypeCategory.Standard,
        }));

        await rule.ExecuteAsync(
            [new IssueParentTarget(child, parent)],
            item => item.IssueUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(child).ShouldBeFalse();
    }

    /// <summary>Zdjęcie rodzica (<c>ParentUuid == null</c>) nie sprawdza kategorii wcale —
    /// epik zdejmujący (nieistniejącego) rodzica nie powinien nigdy trafić na tę regułę.</summary>
    [Fact]
    public async Task Zdjecie_rodzica_pomija_precheck_kategorii()
    {
        var epic = Guid.CreateVersion7();

        var tracker = new ValidationTracker();
        var rule = new IssueParentCategoryRule(new StubGraph([], new()
        {
            [epic] = IssueTypeCategory.Epic,
        }));

        await rule.ExecuteAsync(
            [new IssueParentTarget(epic, null)],
            item => item.IssueUuid,
            tracker,
            CancellationToken.None);

        tracker.HasError(epic).ShouldBeFalse();
    }

    private class StubGraph : IIssueGraphQueries
    {
        private readonly Dictionary<Guid, List<Guid>> _edges;
        private readonly Dictionary<Guid, IssueTypeCategory> _categories;

        public StubGraph(Dictionary<Guid, List<Guid>> edges, Dictionary<Guid, IssueTypeCategory>? categories = null)
        {
            _edges = edges;
            _categories = categories ?? [];
        }

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

        public Task<IReadOnlyDictionary<Guid, IssueTypeCategory>> GetTypeCategoriesAsync(
            IReadOnlyCollection<Guid> issueUuids,
            CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyDictionary<Guid, IssueTypeCategory>>(
                _categories.Where(p => issueUuids.Contains(p.Key)).ToDictionary(p => p.Key, p => p.Value));

        private IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> Map()
            => _edges.ToDictionary(p => p.Key, p => (IReadOnlyList<Guid>)p.Value);
    }
}
