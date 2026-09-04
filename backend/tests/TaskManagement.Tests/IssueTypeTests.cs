using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using Shouldly;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Application.IssueTypes;
using TaskManagement.Domain.IssueTypes;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Typy zgłoszeń (<c>docs/modules/task-management/requirements.md</c> TYP-001..004).
/// </summary>
public class IssueTypeTests
{
    /// <summary>Zgłoszenie bez typu odpada w pipeline'u walidacji WEJŚCIA, przed dotknięciem
    /// bazy — 400, nie 422 (<c>docs/guides/backend/cqrs.md</c> §6).</summary>
    [Fact]
    public void Utworzenie_zgloszenia_bez_typu_jest_odrzucane_przez_walidacje()
    {
        var command = new IssueCreateCommand
        {
            Uuid = Guid.CreateVersion7(),
            ProjectUuid = Guid.CreateVersion7(),
            TypeUuid = Guid.Empty,
            Title = "Tytuł",
        };

        var result = new IssueCreateCommandValidator().Validate(command);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(IssueCreateCommand.TypeUuid));
    }

    [Fact]
    public void Utworzenie_zgloszenia_z_typem_przechodzi_walidacje()
    {
        var command = new IssueCreateCommand
        {
            Uuid = Guid.CreateVersion7(),
            ProjectUuid = Guid.CreateVersion7(),
            TypeUuid = Guid.CreateVersion7(),
            Title = "Tytuł",
        };

        new IssueCreateCommandValidator().Validate(command).IsValid.ShouldBeTrue();
    }

    /// <summary>TYP-004 AC1: usunięcie typu w użyciu jest odrzucane w pre-checku, a komunikat
    /// niesie liczbę zgłoszeń, nie ogólny błąd. Testujemy regułę wsadową bezpośrednio —
    /// wzorzec identyczny jak <c>IssueParentCycleRule</c> w <c>IssueGraphTests</c> — bo handler
    /// dziedziczy po bazie FastEndpoints, która poza żądaniem HTTP wymaga własnego hosta
    /// testowego niepotrzebnego do sprawdzenia samej reguły.</summary>
    [Fact]
    public async Task Usuniecie_typu_w_uzyciu_jest_odrzucane_z_liczba_zgloszen()
    {
        var typeUuid = Guid.CreateVersion7();
        var rule = new IssueTypeInUseRule(new StubIssueTypeUsageProbe(usageCount: 7));
        var tracker = new ValidationTracker();

        var target = new BatchTarget<IssueTypeSchemeRemoveTypeCommand>(
            Guid.CreateVersion7(),
            new IssueTypeSchemeRemoveTypeCommand { TypeUuid = typeUuid });

        await rule.ExecuteAsync([target], t => t.AggregateUuid, tracker, CancellationToken.None);

        tracker.HasError(target.AggregateUuid).ShouldBeTrue();
        var error = tracker.Errors[target.AggregateUuid][0];
        error.ErrorCode.ShouldBe("taskmgmt.issue_type_in_use");
        error.ErrorMessage.ShouldContain("7");
    }

    [Fact]
    public async Task Usuniecie_typu_bez_uzycia_jest_dozwolone()
    {
        var typeUuid = Guid.CreateVersion7();
        var rule = new IssueTypeInUseRule(new StubIssueTypeUsageProbe(usageCount: 0));
        var tracker = new ValidationTracker();

        var target = new BatchTarget<IssueTypeSchemeRemoveTypeCommand>(
            Guid.CreateVersion7(),
            new IssueTypeSchemeRemoveTypeCommand { TypeUuid = typeUuid });

        await rule.ExecuteAsync([target], t => t.AggregateUuid, tracker, CancellationToken.None);

        tracker.HasError(target.AggregateUuid).ShouldBeFalse();
    }

    /// <summary>Zwykła walidacja w handlerze (druga linia obrony) korzysta z tej samej
    /// metody agregatu, więc sprawdzamy tu też, że usunięcie typu bez użycia faktycznie
    /// usuwa go ze schematu (TYP-004 — odrzucenie dotyczy WYŁĄCZNIE typu w użyciu).</summary>
    [Fact]
    public void Usuniecie_typu_bez_uzycia_zmienia_agregat()
    {
        var scheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Testowy", isSystem: false);
        var type = scheme.AddType(
            Guid.CreateVersion7(), "bug", "Błąd", null, "icon", IssueTypeCategory.Standard, orderNo: 0);

        scheme.RemoveType(type.Uuid);

        scheme.HasType(type.Uuid).ShouldBeFalse();
    }

    private sealed class StubIssueTypeUsageProbe : IIssueTypeUsageProbe
    {
        private readonly int _usageCount;

        public StubIssueTypeUsageProbe(int usageCount) => _usageCount = usageCount;

        public Task<int> CountByTypeAsync(Guid typeUuid, CancellationToken cancellationToken)
            => Task.FromResult(_usageCount);
    }
}
