using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Webhooks;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Webhook wychodzący jako dana (API-004) — walidacja przy zapisie i licznik błędów.</summary>
public class WebhookTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private const string ValidSecret = "0123456789abcdef";

    private static Webhook CreateValid(params AutomationTriggerKind[] eventKinds)
        => Webhook.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "https://example.com/hook", ValidSecret,
            eventKinds.Length == 0 ? [AutomationTriggerKind.IssueCreated] : eventKinds, DateTimeOffset.UtcNow);

    [Fact]
    public void Webhook_bez_projektu_jest_odrzucany()
    {
        Should.Throw<DomainException>(() => Webhook.CreateWithUuid(
                Guid.CreateVersion7(), Guid.Empty, "https://example.com/hook", ValidSecret,
                [AutomationTriggerKind.IssueCreated], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.webhook_project_missing");
    }

    [Fact]
    public void Webhook_bez_zdarzen_jest_odrzucany()
    {
        Should.Throw<DomainException>(() => Webhook.CreateWithUuid(
                Guid.CreateVersion7(), ProjectUuid, "https://example.com/hook", ValidSecret, [], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.webhook_without_event");
    }

    [Theory]
    [InlineData("", "taskmgmt.webhook_url_empty")]
    [InlineData("   ", "taskmgmt.webhook_url_empty")]
    [InlineData("not-a-url", "taskmgmt.webhook_url_invalid")]
    [InlineData("ftp://example.com/hook", "taskmgmt.webhook_url_invalid")]
    public void Webhook_z_niepoprawnym_adresem_jest_odrzucany(string url, string expectedErrorCode)
    {
        Should.Throw<DomainException>(() => Webhook.CreateWithUuid(
                Guid.CreateVersion7(), ProjectUuid, url, ValidSecret,
                [AutomationTriggerKind.IssueCreated], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe(expectedErrorCode);
    }

    [Fact]
    public void Webhook_z_za_krotkim_sekretem_jest_odrzucany()
    {
        Should.Throw<DomainException>(() => Webhook.CreateWithUuid(
                Guid.CreateVersion7(), ProjectUuid, "https://example.com/hook", "short",
                [AutomationTriggerKind.IssueCreated], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.webhook_secret_too_short");
    }

    [Fact]
    public void Nowy_webhook_jest_wlaczony_z_wyzerowanym_licznikiem()
    {
        var webhook = CreateValid();

        webhook.IsEnabled.ShouldBeTrue();
        webhook.ConsecutiveFailureCount.ShouldBe(0);
    }

    [Fact]
    public void Subscribes_zwraca_prawde_tylko_dla_zapisanych_zdarzen_wlaczonego_webhooka()
    {
        var webhook = CreateValid(AutomationTriggerKind.IssueCreated, AutomationTriggerKind.CommentAdded);

        webhook.Subscribes(AutomationTriggerKind.IssueCreated).ShouldBeTrue();
        webhook.Subscribes(AutomationTriggerKind.CommentAdded).ShouldBeTrue();
        webhook.Subscribes(AutomationTriggerKind.IssueStateChanged).ShouldBeFalse();
    }

    [Fact]
    public void Wylaczony_webhook_nie_subskrybuje_niczego()
    {
        var webhook = CreateValid(AutomationTriggerKind.IssueCreated);
        webhook.Disable();

        webhook.Subscribes(AutomationTriggerKind.IssueCreated).ShouldBeFalse();
    }

    [Fact]
    public void Sukces_dostarczenia_zeruje_licznik_bledow()
    {
        var webhook = CreateValid();

        for (var i = 0; i < 5; i++)
        {
            webhook.RecordDeliveryFailure();
        }

        webhook.ConsecutiveFailureCount.ShouldBe(5);

        webhook.RecordDeliverySuccess();

        webhook.ConsecutiveFailureCount.ShouldBe(0);
    }

    [Fact]
    public void Webhook_wylacza_sie_sam_po_progu_kolejnych_bledow()
    {
        var webhook = CreateValid();

        for (var i = 0; i < Webhook.AutoDisableThreshold - 1; i++)
        {
            webhook.RecordDeliveryFailure();
            webhook.IsEnabled.ShouldBeTrue($"nie powinien się jeszcze wyłączyć po {i + 1} błędach");
        }

        webhook.RecordDeliveryFailure();

        webhook.IsEnabled.ShouldBeFalse();
        webhook.ConsecutiveFailureCount.ShouldBe(Webhook.AutoDisableThreshold);
    }

    [Fact]
    public void Reczne_wlaczenie_resetuje_licznik_bledow()
    {
        var webhook = CreateValid();

        for (var i = 0; i < Webhook.AutoDisableThreshold; i++)
        {
            webhook.RecordDeliveryFailure();
        }

        webhook.IsEnabled.ShouldBeFalse();

        webhook.Enable();

        webhook.IsEnabled.ShouldBeTrue();
        webhook.ConsecutiveFailureCount.ShouldBe(0);
    }

    [Fact]
    public void Set_nadpisuje_adres_sekret_i_zdarzenia()
    {
        var webhook = CreateValid(AutomationTriggerKind.IssueCreated);

        webhook.Set("https://example.com/other", "fedcba9876543210", [AutomationTriggerKind.CommentAdded]);

        webhook.Url.ShouldBe("https://example.com/other");
        webhook.EventKinds.ShouldBe([AutomationTriggerKind.CommentAdded]);
        webhook.Subscribes(AutomationTriggerKind.IssueCreated).ShouldBeFalse();
    }
}
