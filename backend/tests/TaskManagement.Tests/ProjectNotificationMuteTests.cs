using Shouldly;
using TaskManagement.Domain.Projects;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Wyciszenie powiadomień z projektu per użytkownik (NTF-003) — ustawienie osobiste,
/// idempotentne dodanie/usunięcie z <c>MutedNotificationUserUuids</c>.</summary>
public class ProjectNotificationMuteTests
{
    private static Project NewProject()
        => Project.CreateWithUuid(
            Guid.CreateVersion7(), "DEV", "Rozwój", ProjectKind.Delivery, Guid.CreateVersion7(), Guid.CreateVersion7(), true);

    [Fact]
    public void Projekt_domyslnie_nie_ma_wyciszonych_uzytkownikow()
        => NewProject().MutedNotificationUserUuids.ShouldBeEmpty();

    [Fact]
    public void Wyciszenie_dopisuje_uzytkownika()
    {
        var project = NewProject();
        var user = Guid.CreateVersion7();

        project.SetNotificationMuted(user, muted: true, DateTimeOffset.UtcNow);

        project.MutedNotificationUserUuids.ShouldContain(user);
    }

    [Fact]
    public void Powtorne_wyciszenie_tego_samego_uzytkownika_jest_idempotentne()
    {
        var project = NewProject();
        var user = Guid.CreateVersion7();

        project.SetNotificationMuted(user, muted: true, DateTimeOffset.UtcNow);
        project.SetNotificationMuted(user, muted: true, DateTimeOffset.UtcNow);

        project.MutedNotificationUserUuids.Count(u => u == user).ShouldBe(1);
    }

    [Fact]
    public void Odciszenie_usuwa_uzytkownika()
    {
        var project = NewProject();
        var user = Guid.CreateVersion7();
        project.SetNotificationMuted(user, muted: true, DateTimeOffset.UtcNow);

        project.SetNotificationMuted(user, muted: false, DateTimeOffset.UtcNow);

        project.MutedNotificationUserUuids.ShouldNotContain(user);
    }

    [Fact]
    public void Odciszenie_niewyciszonego_uzytkownika_jest_idempotentne_i_niczego_nie_zmienia()
    {
        var project = NewProject();
        var user = Guid.CreateVersion7();

        project.SetNotificationMuted(user, muted: false, DateTimeOffset.UtcNow);

        project.MutedNotificationUserUuids.ShouldBeEmpty();
    }

    [Fact]
    public void Wyciszenie_dotyczy_wylacznie_wskazanego_uzytkownika()
    {
        var project = NewProject();
        var user1 = Guid.CreateVersion7();
        var user2 = Guid.CreateVersion7();
        project.SetNotificationMuted(user1, muted: true, DateTimeOffset.UtcNow);

        project.SetNotificationMuted(user2, muted: true, DateTimeOffset.UtcNow);

        project.MutedNotificationUserUuids.ShouldContain(user1);
        project.MutedNotificationUserUuids.ShouldContain(user2);
    }
}
