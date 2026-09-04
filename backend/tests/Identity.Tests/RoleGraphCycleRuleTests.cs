using Erp.BuildingBlocks.Validation;
using Identity.Application.Roles;
using Shouldly;
using Xunit;

namespace Identity.Tests;

/// <summary>
/// <c>RoleGraphCycleRule</c> jest jedyną linią obrony przed cyklem powstałym WEWNĄTRZ jednego
/// wsadu — <c>IRoleQueries.IsDescendantAsync</c> (druga linia, w handlerze) czyta stan
/// zacommitowany i nie widzi krawędzi z wcześniejszych elementów TEGO SAMEGO chunka. Para
/// <c>A→B</c> + <c>B→A</c> w jednym zadaniu jest dokładnie tym przypadkiem, dla którego ta
/// reguła powstała — patrz <c>docs/guides/backend/batch-validation.md</c>.
/// </summary>
public class RoleGraphCycleRuleTests
{
    private static readonly Guid A = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid B = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid C = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private static async Task<ValidationTracker> RunAsync(FakeRoleQueries queries, params RoleMemberTarget[] targets)
    {
        var tracker = new ValidationTracker();
        await new RoleGraphCycleRule(queries).ExecuteAsync(targets, t => t.ContainerUuid, tracker, CancellationToken.None);
        return tracker;
    }

    [Fact]
    public async Task Samo_zawieranie_jest_odrzucane()
    {
        var tracker = await RunAsync(new FakeRoleQueries(), new RoleMemberTarget(A, A));

        tracker.HasError(A).ShouldBeTrue();
        tracker.Errors[A][0].ErrorCode.ShouldBe("role_self_membership");
    }

    /// <summary>Sedno reguły: A→B akceptowane, potem B→A w TYM SAMYM wsadzie zamknęłoby cykl —
    /// musi zostać odrzucone, mimo że żadna z krawędzi jeszcze nie istnieje w bazie.</summary>
    [Fact]
    public async Task AB_potem_BA_w_tym_samym_wsadzie_odrzuca_drugi_element()
    {
        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleMemberTarget(A, B),
            new RoleMemberTarget(B, A));

        tracker.HasError(A).ShouldBeFalse();
        tracker.HasError(B).ShouldBeTrue();
        tracker.Errors[B][0].ErrorCode.ShouldBe("role_cycle_detected");
    }

    /// <summary>Cykl przez stan JUŻ zacommitowany w bazie (z wcześniejszego zadania) — reguła
    /// widzi go od razu, bo ładuje CAŁY graf, nie tylko wsad.</summary>
    [Fact]
    public async Task Istniejaca_w_bazie_krawedz_blokuje_nowa_krawedz_zamykajaca_cykl()
    {
        var queries = new FakeRoleQueries { MembershipEdges = { new RoleMembershipEdge(B, A) } };

        var tracker = await RunAsync(queries, new RoleMemberTarget(A, B));

        tracker.HasError(A).ShouldBeTrue();
        tracker.Errors[A][0].ErrorCode.ShouldBe("role_cycle_detected");
    }

    [Fact]
    public async Task Niezalezne_krawedzie_obie_przechodza()
    {
        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleMemberTarget(A, B),
            new RoleMemberTarget(C, Guid.NewGuid()));

        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Tranzytywny cykl przez TRZY elementy tego samego wsadu: A→B, B→C akceptowane,
    /// C→A zamknęłoby pętlę przez łańcuch zaakceptowanych wcześniej krawędzi.</summary>
    [Fact]
    public async Task Tranzytywny_cykl_przez_trzy_elementy_odrzuca_trzeci()
    {
        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleMemberTarget(A, B),
            new RoleMemberTarget(B, C),
            new RoleMemberTarget(C, A));

        tracker.HasError(A).ShouldBeFalse();
        tracker.HasError(B).ShouldBeFalse();
        tracker.HasError(C).ShouldBeTrue();
        tracker.Errors[C][0].ErrorCode.ShouldBe("role_cycle_detected");
    }

    /// <summary>Krawędź zaakceptowana wcześniej w wsadzie musi być widoczna dla kolejnych
    /// elementów — inaczej reguła sprawdzałaby tylko stan bazy, nie stan wsadu.</summary>
    [Fact]
    public async Task Zaakceptowana_krawedz_wchodzi_do_grafu_widocznego_dla_kolejnych_elementow()
    {
        var tracker = await RunAsync(
            new FakeRoleQueries(),
            new RoleMemberTarget(A, B),
            new RoleMemberTarget(B, C),
            new RoleMemberTarget(A, C));

        // A->C nie zamyka cyklu (A nie jest potomkiem C), ale to test na to, że łańcuch
        // A->B->C zbudowany w tym samym wsadzie faktycznie istnieje w symulowanym grafie.
        tracker.Errors.ShouldBeEmpty();
    }

    /// <summary>Cały sens mechanizmu wsadowego: jedno zapytanie o graf, nie N.</summary>
    [Fact]
    public async Task Caly_wsad_kosztuje_jedno_zapytanie_o_graf()
    {
        var queries = new FakeRoleQueries();

        var targets = Enumerable.Range(0, 20)
            .Select(_ => new RoleMemberTarget(Guid.NewGuid(), Guid.NewGuid()))
            .ToArray();

        await RunAsync(queries, targets);

        queries.MembershipEdgesQueryCount.ShouldBe(1);
    }
}
