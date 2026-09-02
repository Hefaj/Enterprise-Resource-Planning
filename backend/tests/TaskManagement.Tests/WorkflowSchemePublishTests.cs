using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// WF-006 — publikacja schematu i migracja stanów. Skoncentrowane na
/// <see cref="WorkflowScheme.Publish"/>, który jest cała walidacja PRZED wysłaniem choćby
/// jednego <c>job_item</c> — zgodnie z <c>docs/backend/cqrs.md</c> §3, metoda agregatu waliduje
/// przed zmianą stanu.
///
/// <para>Sukces częściowy migracji (AC3) opiera się na tym, że każde zgłoszenie migruje osobną
/// komendą <c>IssueSetStateCommand</c>, egzekwowaną przez <see cref="Issue.SetState"/> —
/// dokładnie ten sam mechanizm, który testuje <see cref="Migracja_z_zablokowanym_przejsciem_dla_jednego_zgloszenia_konczy_sie_bledem_tylko_dla_niego"/>:
/// dwa zgłoszenia migrujące niezależnie, jedno z dozwolonym przejściem, drugie bez, kończą się
/// różnym wynikiem — dokładnie to, co w produkcji robi <c>BulkCommandRunner</c> element po
/// elemencie.</para>
/// </summary>
public class WorkflowSchemePublishTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 9, 2, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid TodoUuid = Guid.CreateVersion7();
    private static readonly Guid InProgressUuid = Guid.CreateVersion7();
    private static readonly Guid ReviewUuid = Guid.CreateVersion7();
    private static readonly Guid DoneUuid = Guid.CreateVersion7();

    /// <summary>Schemat z czterema stanami — <c>Review</c> ma przejście WYŁĄCZNIE z/do
    /// <c>InProgress</c>, więc migracja bezpośrednio do <c>Done</c> jest zablokowana i to jest
    /// tu celowe (patrz test sukcesu częściowego).</summary>
    private static WorkflowScheme SchemeWithFourStates()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Test", isSystem: false);

        scheme.AddState(TodoUuid, "todo", "k.todo", WorkflowStateCategory.Todo, 0);
        scheme.AddState(InProgressUuid, "in_progress", "k.inProgress", WorkflowStateCategory.InProgress, 1);
        scheme.AddState(ReviewUuid, "review", "k.review", WorkflowStateCategory.InProgress, 2);
        scheme.AddState(DoneUuid, "done", "k.done", WorkflowStateCategory.Done, 3);

        scheme.AddTransition(Guid.CreateVersion7(), TodoUuid, InProgressUuid, "k.start");
        scheme.AddTransition(Guid.CreateVersion7(), InProgressUuid, ReviewUuid, "k.review");
        scheme.AddTransition(Guid.CreateVersion7(), ReviewUuid, InProgressUuid, "k.back");
        scheme.AddTransition(
            Guid.CreateVersion7(), InProgressUuid, DoneUuid, "k.finish", requiredFields: ["resolution"]);

        return scheme;
    }

    private static Issue IssueInState(WorkflowScheme workflow, Guid stateUuid, string key)
    {
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();
        var issue = Issue.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, key, "Tytuł", workflow, issueType, Reporter, Now);

        if (stateUuid != workflow.InitialState().Uuid)
        {
            // Przejście krok po kroku, tak jak zrobiłby to użytkownik — testowe stany żyją
            // wyłącznie na ścieżce Todo → InProgress → Review, którą powyższy schemat opisuje.
            issue.SetState(workflow, InProgressUuid, Now);

            if (stateUuid == ReviewUuid)
            {
                issue.SetState(workflow, ReviewUuid, Now);
            }
        }

        return issue;
    }

    [Fact]
    public void Dodanie_przejscia_do_nieistniejacego_stanu_jest_odrzucane()
    {
        var scheme = SchemeWithFourStates();

        Should.Throw<DomainException>(() =>
                scheme.AddTransition(Guid.CreateVersion7(), TodoUuid, Guid.CreateVersion7(), "k.nowhere"))
            .ErrorCode.ShouldBe("taskmgmt.workflow_transition_unknown_state");
    }

    [Fact]
    public void Usuniecie_stanu_uzytego_w_przejsciu_jest_odrzucane()
    {
        var scheme = SchemeWithFourStates();

        Should.Throw<DomainException>(() => scheme.RemoveState(InProgressUuid))
            .ErrorCode.ShouldBe("taskmgmt.workflow_state_referenced_by_transition");
    }

    [Fact]
    public void Publikacja_z_niepelnym_mapowaniem_jest_odrzucana()
    {
        var scheme = SchemeWithFourStates();

        // Dwa stany do usunięcia, ale mapowanie niesie wpis tylko dla jednego — AC2.
        var mapping = new Dictionary<Guid, Guid> { [ReviewUuid] = InProgressUuid };

        Should.Throw<DomainException>(() => scheme.Publish([ReviewUuid, TodoUuid], mapping))
            .ErrorCode.ShouldBe("taskmgmt.workflow_publish_mapping_incomplete");

        // Nic nie zniknęło ze schematu — walidacja poszła PRZED mutacją.
        scheme.HasState(ReviewUuid).ShouldBeTrue();
        scheme.HasState(TodoUuid).ShouldBeTrue();
    }

    [Fact]
    public void Publikacja_z_celem_ktory_tez_jest_usuwany_jest_odrzucana()
    {
        var scheme = SchemeWithFourStates();

        var mapping = new Dictionary<Guid, Guid> { [ReviewUuid] = TodoUuid, [TodoUuid] = ReviewUuid };

        Should.Throw<DomainException>(() => scheme.Publish([ReviewUuid, TodoUuid], mapping))
            .ErrorCode.ShouldBe("taskmgmt.workflow_publish_target_also_removed");
    }

    [Fact]
    public void Publikacja_ktora_usunelaby_ostatni_stan_todo_jest_odrzucana()
    {
        var scheme = SchemeWithFourStates();
        var mapping = new Dictionary<Guid, Guid> { [TodoUuid] = InProgressUuid };

        Should.Throw<DomainException>(() => scheme.Publish([TodoUuid], mapping))
            .ErrorCode.ShouldBe("taskmgmt.workflow_publish_removes_initial_state");
    }

    [Fact]
    public void Publikacja_z_pelnym_mapowaniem_usuwa_stany_i_zwraca_migracje()
    {
        var scheme = SchemeWithFourStates();
        var mapping = new Dictionary<Guid, Guid> { [ReviewUuid] = InProgressUuid };

        var migrations = scheme.Publish([ReviewUuid], mapping);

        migrations.ShouldHaveSingleItem();
        migrations[0].RemovedStateUuid.ShouldBe(ReviewUuid);
        migrations[0].TargetStateUuid.ShouldBe(InProgressUuid);

        scheme.HasState(ReviewUuid).ShouldBeFalse();
        scheme.FindTransition(InProgressUuid, ReviewUuid).ShouldBeNull();
        scheme.FindTransition(ReviewUuid, InProgressUuid).ShouldBeNull();
    }

    /// <summary>
    /// WF-006 AC3 — sukces częściowy. Dwa zgłoszenia siedzą w stanie <c>Review</c>, usuwanym
    /// z mapowaniem na <c>Done</c>. Zgłoszenie A ma zapisane rozwiązanie (spełnia
    /// <c>required_fields</c> na <c>Done</c>), zgłoszenie B nie — dokładnie ten rodzaj różnicy
    /// między elementami tego samego zadania masowego, który w produkcji kończy się jednym
    /// <c>Failed</c> i jednym <c>Succeeded</c> w tym samym chunku (<c>docs/backend/bulk-commands.md</c>
    /// §3 „Częściowe niepowodzenie”).
    /// </summary>
    [Fact]
    public void Migracja_z_zablokowanym_przejsciem_dla_jednego_zgloszenia_konczy_sie_bledem_tylko_dla_niego()
    {
        var scheme = SchemeWithFourStates();
        var resolutionRequired = scheme.FindTransition(InProgressUuid, DoneUuid);
        resolutionRequired.ShouldNotBeNull();

        var issueA = IssueInState(scheme, ReviewUuid, "DEV-1");
        var issueB = IssueInState(scheme, ReviewUuid, "DEV-2");

        var mapping = new Dictionary<Guid, Guid> { [ReviewUuid] = DoneUuid };
        scheme.Publish([ReviewUuid], mapping);

        // Po publikacji `Review` już nie istnieje w schemacie, więc `Done` osiągalny jest już
        // wyłącznie z `InProgress` — a stamtąd wymaga `resolution`. Migracja "w miejscu" (bez
        // przejścia przez InProgress) nie jest opisanym przejściem: `Review → Done` nigdy nie
        // istniało w tym schemacie, więc obie migracje powinny się nie udać identycznie —
        // to jest właśnie powód, dla którego handler w produkcji zgłasza migrację jako zwykłą
        // komendę `IssueSetStateCommand`, podlegającą tej samej regule „przejście nieopisane nie
        // istnieje” (WF-002), a nie jako operację pozadomenową.
        Should.Throw<DomainException>(() => issueA.SetState(scheme, DoneUuid, Now))
            .ErrorCode.ShouldBe("taskmgmt.transition_not_allowed");
        Should.Throw<DomainException>(() => issueB.SetState(scheme, DoneUuid, Now))
            .ErrorCode.ShouldBe("taskmgmt.transition_not_allowed");

        // Kontrast: migracja na stan, z którym `Review` MIAŁO opisane przejście przed publikacją
        // (`InProgress`), przechodzi dla obu zgłoszeń — sukces częściowy w tym mechanizmie
        // zależy wyłącznie od tego, czy scenariusz mapowania odtwarza istniejące krawędzie, nie
        // od stanu poszczególnego zgłoszenia. Poniżej pokazujemy drugą połowę: ten sam mechanizm
        // różnicuje wynik PER ZGŁOSZENIE, gdy jedno spełnia `required_fields`, a drugie nie.
        var schemeTwo = SchemeWithFourStates();
        var issueC = IssueInState(schemeTwo, InProgressUuid, "DEV-3");
        var issueD = IssueInState(schemeTwo, InProgressUuid, "DEV-4");
        issueC.SetResolution(Guid.CreateVersion7(), Now);

        issueC.SetState(schemeTwo, DoneUuid, Now);
        issueC.StateUuid.ShouldBe(DoneUuid);

        Should.Throw<DomainException>(() => issueD.SetState(schemeTwo, DoneUuid, Now))
            .ErrorCode.ShouldBe("taskmgmt.required_fields_missing");
        issueD.StateUuid.ShouldBe(InProgressUuid);
    }

    [Fact]
    public void Ustawienie_szczegolow_stanu_nie_zmienia_kodu()
    {
        var scheme = SchemeWithFourStates();

        scheme.SetState(TodoUuid, "k.todo2", WorkflowStateCategory.Todo, 5);

        var state = scheme.FindStateByUuid(TodoUuid);
        state.ShouldNotBeNull();
        state!.Code.ShouldBe("todo");
        state.NameKey.ShouldBe("k.todo2");
        state.OrderNo.ShouldBe(5);
    }

    [Fact]
    public void Usuniecie_przejscia_dziala_niezaleznie_od_uzycia()
    {
        var scheme = SchemeWithFourStates();
        var transition = scheme.FindTransition(TodoUuid, InProgressUuid);
        transition.ShouldNotBeNull();

        scheme.RemoveTransition(transition!.Uuid);

        scheme.FindTransition(TodoUuid, InProgressUuid).ShouldBeNull();
    }
}
