using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Issues.Events;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// REQ-003: zamknięcie zgłoszenia raisuje <see cref="IssueClosed"/> i utrzymuje
/// <see cref="Issue.StateCategory"/> w zgodzie ze stanem — to na tym duplikacie stoi filtrowany
/// indeks skanu terminów (faza 5) i handler przeliczający stan realizacji zlecenia.
/// </summary>
public class IssueDeliveryStateTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid TodoUuid = Guid.CreateVersion7();
    private static readonly Guid InProgressUuid = Guid.CreateVersion7();
    private static readonly Guid DoneUuid = Guid.CreateVersion7();

    private static WorkflowScheme SimpleScheme()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Test", isSystem: false);

        scheme.AddState(TodoUuid, "todo", "k.todo", WorkflowStateCategory.Todo, 0);
        scheme.AddState(InProgressUuid, "in_progress", "k.inProgress", WorkflowStateCategory.InProgress, 1);
        scheme.AddState(DoneUuid, "done", "k.done", WorkflowStateCategory.Done, 2);

        scheme.AddTransition(Guid.CreateVersion7(), TodoUuid, InProgressUuid, "k.start");
        scheme.AddTransition(Guid.CreateVersion7(), InProgressUuid, DoneUuid, "k.finish");
        scheme.AddTransition(Guid.CreateVersion7(), DoneUuid, TodoUuid, "k.reopen");

        return scheme;
    }

    private static Issue NewIssue(WorkflowScheme scheme)
        => Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", scheme,
            IssueTypeSchemeDefaults.Build().DefaultType(), Reporter, Now);

    [Fact]
    public void Nowe_zgloszenie_ma_kategorie_stanu_poczatkowego()
        => NewIssue(SimpleScheme()).StateCategory.ShouldBe(WorkflowStateCategory.Todo);

    [Fact]
    public void Przejscie_do_kategorii_w_toku_nie_raisuje_zamkniecia()
    {
        var scheme = SimpleScheme();
        var issue = NewIssue(scheme);

        issue.SetState(scheme, InProgressUuid, Now);

        issue.StateCategory.ShouldBe(WorkflowStateCategory.InProgress);
        issue.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void Przejscie_do_kategorii_zrobione_raisuje_issue_closed()
    {
        var scheme = SimpleScheme();
        var issue = NewIssue(scheme);
        issue.SetState(scheme, InProgressUuid, Now);

        issue.SetState(scheme, DoneUuid, Now.AddHours(1));

        issue.StateCategory.ShouldBe(WorkflowStateCategory.Done);
        issue.DomainEvents.ShouldHaveSingleItem();
        var raised = issue.DomainEvents.Single().ShouldBeOfType<IssueClosed>();
        raised.IssueUuid.ShouldBe(issue.Uuid);
        raised.OccurredAt.ShouldBe(Now.AddHours(1));
    }

    [Fact]
    public void Przejscie_w_to_samo_miejsce_nie_raisuje_niczego()
    {
        var scheme = SimpleScheme();
        var issue = NewIssue(scheme);

        issue.SetState(scheme, TodoUuid, Now);

        issue.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void Ponowne_otwarcie_nie_raisuje_zamkniecia_i_aktualizuje_kategorie()
    {
        var scheme = SimpleScheme();
        var issue = NewIssue(scheme);
        issue.SetState(scheme, InProgressUuid, Now);
        issue.SetState(scheme, DoneUuid, Now.AddHours(1));
        issue.ClearDomainEvents();

        issue.SetState(scheme, TodoUuid, Now.AddHours(2));

        issue.StateCategory.ShouldBe(WorkflowStateCategory.Todo);
        issue.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void Nowe_zgloszenie_nie_ma_stanu_realizacji()
        => NewIssue(SimpleScheme()).DerivedDeliveryState.ShouldBe(IssueDeliveryState.None);

    [Fact]
    public void Przeliczenie_stanu_realizacji_zapisuje_wartosc()
    {
        var issue = NewIssue(SimpleScheme());

        issue.SetDerivedDeliveryState(IssueDeliveryState.Delivered, Now);

        issue.DerivedDeliveryState.ShouldBe(IssueDeliveryState.Delivered);
    }
}
