using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Shouldly;
using TaskManagement.Application.Issues;
using TaskManagement.Application.Projects;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Filtr wyciszenia projektu w <see cref="IssueNotificationPublisher"/> (NTF-003). Czysty test
/// jednostkowy — obie zależności publishera (<see cref="IIntegrationEventPublisher"/>,
/// <see cref="IProjectNotificationMuteQueries"/>) są fake'ami, bez bazy.
///
/// <para><b>Kluczowy przypadek</b>: wyciszony obserwujący traci
/// <c>taskmgmt.issue.state_changed</c>, ale NADAL dostaje <c>taskmgmt.issue.mentioned</c> —
/// wzmianka jest jawnym wywołaniem konkretnej osoby i celowo omija wyciszenie projektu.</para>
/// </summary>
public class IssueNotificationPublisherTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid MutedWatcher = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 9, 3, 12, 0, 0, TimeSpan.Zero);

    private static Issue NewIssueWithWatcher(Guid watcherUuid)
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);

        issue.Watch(watcherUuid, Now);

        return issue;
    }

    [Fact]
    public async Task Wyciszony_obserwujacy_nie_dostaje_powiadomienia_o_zmianie_stanu()
    {
        var issue = NewIssueWithWatcher(MutedWatcher);
        var publisher = new FakeIntegrationEventPublisher();
        var muteQueries = new FakeProjectNotificationMuteQueries([MutedWatcher]);
        var sut = new IssueNotificationPublisher(publisher, muteQueries);

        await sut.PublishStateChangedAsync(issue, actorUuid: null, Now, Guid.CreateVersion7(), CancellationToken.None);

        publisher.Published.ShouldBeEmpty();
    }

    [Fact]
    public async Task Wyciszony_obserwujacy_nadal_dostaje_wzmianke()
    {
        var issue = NewIssueWithWatcher(MutedWatcher);
        var publisher = new FakeIntegrationEventPublisher();
        var muteQueries = new FakeProjectNotificationMuteQueries([MutedWatcher]);
        var sut = new IssueNotificationPublisher(publisher, muteQueries);

        await sut.PublishMentionedAsync(issue, MutedWatcher, actorUuid: Reporter, Now, Guid.CreateVersion7(), CancellationToken.None);

        publisher.Published.Count.ShouldBe(1);
        var notification = publisher.Published.Single().ShouldBeOfType<UserNotificationRequested>();
        notification.Kind.ShouldBe("taskmgmt.issue.mentioned");
        notification.Recipients.ShouldContain(MutedWatcher.ToString());
    }

    [Fact]
    public async Task Gdy_wszyscy_odbiorcy_sa_wyciszeni_nic_sie_nie_publikuje()
    {
        var issue = NewIssueWithWatcher(MutedWatcher);
        var publisher = new FakeIntegrationEventPublisher();
        var muteQueries = new FakeProjectNotificationMuteQueries([MutedWatcher]);
        var sut = new IssueNotificationPublisher(publisher, muteQueries);

        await sut.PublishCommentedAsync(issue, actorUuid: null, Now, Guid.CreateVersion7(), CancellationToken.None);

        publisher.Published.ShouldBeEmpty();
    }

    [Fact]
    public async Task Niewyciszony_obserwujacy_dostaje_powiadomienie_o_zmianie_stanu()
    {
        var otherWatcher = Guid.CreateVersion7();
        var issue = NewIssueWithWatcher(otherWatcher);
        var publisher = new FakeIntegrationEventPublisher();
        var muteQueries = new FakeProjectNotificationMuteQueries([MutedWatcher]);
        var sut = new IssueNotificationPublisher(publisher, muteQueries);

        await sut.PublishStateChangedAsync(issue, actorUuid: null, Now, Guid.CreateVersion7(), CancellationToken.None);

        publisher.Published.Count.ShouldBe(1);
        var notification = publisher.Published.Single().ShouldBeOfType<UserNotificationRequested>();
        notification.Recipients.ShouldContain(otherWatcher.ToString());
    }

    /// <summary>Rejestruje opublikowane zdarzenia zamiast wysyłać je na broker (outbox tu nie
    /// wchodzi w grę — to czysty test jednostkowy, bez bazy).</summary>
    private sealed class FakeIntegrationEventPublisher : IIntegrationEventPublisher
    {
        public List<object> Published { get; } = [];

        public Task PublishAsync(object integrationEvent, CancellationToken cancellationToken = default)
        {
            Published.Add(integrationEvent);
            return Task.CompletedTask;
        }

        public Task PublishAllAsync(IEnumerable<object> integrationEvents, CancellationToken cancellationToken = default)
        {
            Published.AddRange(integrationEvents);
            return Task.CompletedTask;
        }

        public Task SaveChangesAndFlushAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    /// <summary>Zwraca skonfigurowany, stały zbiór wyciszonych uuidów niezależnie od projektu —
    /// wystarczające dla testu jednostkowego z jednym projektem.</summary>
    private sealed class FakeProjectNotificationMuteQueries : IProjectNotificationMuteQueries
    {
        private readonly HashSet<Guid> _muted;

        public FakeProjectNotificationMuteQueries(IEnumerable<Guid> muted) => _muted = [.. muted];

        public Task<HashSet<Guid>> GetMutedUserUuidsAsync(Guid projectUuid, CancellationToken cancellationToken)
            => Task.FromResult(_muted);
    }
}
