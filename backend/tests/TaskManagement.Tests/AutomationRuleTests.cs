using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Automation;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Reguła automatyzacji jako dana (AUT-001) — walidacja przy zapisie.</summary>
public class AutomationRuleTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static AutomationAction OneAction(Guid ruleUuid)
        => AutomationAction.Create(Guid.CreateVersion7(), ruleUuid, AutomationActionKind.AddComment, "{\"body\":\"x\"}", 0);

    [Fact]
    public void Regula_bez_akcji_jest_odrzucana()
    {
        var uuid = Guid.CreateVersion7();

        Should.Throw<DomainException>(() => AutomationRule.CreateWithUuid(
                uuid, ProjectUuid, "Reguła", AutomationTriggerKind.IssueCreated, null, [], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.automation_rule_without_action");
    }

    [Fact]
    public void Regula_z_pusta_nazwa_jest_odrzucana()
    {
        var uuid = Guid.CreateVersion7();

        Should.Throw<DomainException>(() => AutomationRule.CreateWithUuid(
                uuid, ProjectUuid, "   ", AutomationTriggerKind.IssueCreated, null, [OneAction(uuid)], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.automation_rule_name_empty");
    }

    [Fact]
    public void Regula_bez_projektu_jest_odrzucana()
    {
        var uuid = Guid.CreateVersion7();

        Should.Throw<DomainException>(() => AutomationRule.CreateWithUuid(
                uuid, Guid.Empty, "Reguła", AutomationTriggerKind.IssueCreated, null, [OneAction(uuid)], DateTimeOffset.UtcNow))
            .ErrorCode.ShouldBe("taskmgmt.automation_rule_project_missing");
    }

    [Fact]
    public void Nowa_regula_jest_wlaczona_domyslnie()
    {
        var uuid = Guid.CreateVersion7();

        var rule = AutomationRule.CreateWithUuid(
            uuid, ProjectUuid, "Reguła", AutomationTriggerKind.IssueCreated, null, [OneAction(uuid)], DateTimeOffset.UtcNow);

        rule.IsEnabled.ShouldBeTrue();
    }

    [Fact]
    public void Wylaczenie_nie_usuwa_akcji()
    {
        var uuid = Guid.CreateVersion7();

        var rule = AutomationRule.CreateWithUuid(
            uuid, ProjectUuid, "Reguła", AutomationTriggerKind.IssueCreated, null, [OneAction(uuid)], DateTimeOffset.UtcNow);

        rule.Disable();

        rule.IsEnabled.ShouldBeFalse();
        rule.Actions.Count.ShouldBe(1);
    }

    [Fact]
    public void Set_nadpisuje_akcje_i_odrzuca_pusta_liste()
    {
        var uuid = Guid.CreateVersion7();

        var rule = AutomationRule.CreateWithUuid(
            uuid, ProjectUuid, "Reguła", AutomationTriggerKind.IssueCreated, null, [OneAction(uuid)], DateTimeOffset.UtcNow);

        Should.Throw<DomainException>(() => rule.Set("Reguła", AutomationTriggerKind.IssueCreated, null, []))
            .ErrorCode.ShouldBe("taskmgmt.automation_rule_without_action");

        // Stan sprzed nieudanej próby zostaje nietknięty.
        rule.Actions.Count.ShouldBe(1);
    }
}
