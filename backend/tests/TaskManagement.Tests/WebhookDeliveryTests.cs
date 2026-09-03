using Shouldly;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Webhooks;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Dostarczenie webhooka (API-004) — stan początkowy, ponowienia i wyczerpanie prób.</summary>
public class WebhookDeliveryTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-01-01T00:00:00Z");

    private static WebhookDelivery CreatePending()
        => WebhookDelivery.CreateWithUuid(
            Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(),
            AutomationTriggerKind.IssueCreated, "{\"event\":\"issue.created\"}", Now);

    [Fact]
    public void Nowe_dostarczenie_jest_oczekujace_i_gotowe_od_razu()
    {
        var delivery = CreatePending();

        delivery.Status.ShouldBe(WebhookDeliveryStatus.Pending);
        delivery.AttemptCount.ShouldBe(0);
        delivery.NextAttemptAt.ShouldBe(Now);
    }

    [Fact]
    public void Sukces_konczy_dostarczenie_i_czysci_blad()
    {
        var delivery = CreatePending();
        delivery.RecordFailure("HTTP 500", Now, TimeSpan.FromSeconds(15));

        delivery.RecordSuccess(Now.AddSeconds(30));

        delivery.Status.ShouldBe(WebhookDeliveryStatus.Sent);
        delivery.LastError.ShouldBeNull();
    }

    [Fact]
    public void Nieudana_proba_ponizej_limitu_zostaje_oczekujaca_z_odstepem()
    {
        var delivery = CreatePending();

        var exhausted = delivery.RecordFailure("HTTP 500", Now, TimeSpan.FromSeconds(15));

        exhausted.ShouldBeFalse();
        delivery.Status.ShouldBe(WebhookDeliveryStatus.Pending);
        delivery.AttemptCount.ShouldBe(1);
        delivery.NextAttemptAt.ShouldBe(Now.AddSeconds(15));
        delivery.LastError.ShouldBe("HTTP 500");
    }

    [Fact]
    public void Proba_ktora_wyczerpuje_limit_konczy_dostarczenie_jako_nieudane()
    {
        var delivery = CreatePending();

        for (var i = 0; i < WebhookDelivery.MaxAttempts - 1; i++)
        {
            delivery.RecordFailure("HTTP 500", Now, TimeSpan.FromSeconds(1)).ShouldBeFalse();
        }

        var exhausted = delivery.RecordFailure("HTTP 500", Now, TimeSpan.FromSeconds(1));

        exhausted.ShouldBeTrue();
        delivery.Status.ShouldBe(WebhookDeliveryStatus.Failed);
        delivery.AttemptCount.ShouldBe(WebhookDelivery.MaxAttempts);
    }

    [Fact]
    public void Zbyt_dlugi_komunikat_bledu_jest_przycinany()
    {
        var delivery = CreatePending();
        var longError = new string('x', WebhookDelivery.MaxErrorMessageLength + 100);

        delivery.RecordFailure(longError, Now, TimeSpan.FromSeconds(1));

        delivery.LastError!.Length.ShouldBe(WebhookDelivery.MaxErrorMessageLength);
    }
}
