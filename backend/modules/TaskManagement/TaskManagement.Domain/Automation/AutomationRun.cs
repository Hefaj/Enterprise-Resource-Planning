using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Automation;

/// <summary>
/// Log uruchomienia reguły (AUT-002 AC1) — tylko do dopisywania, wzorem <c>IssueActivity</c>.
/// Zapisywany <b>wyłącznie</b>, gdy warunek reguły był prawdziwy i akcje faktycznie próbowały
/// się wykonać — pominięcie przez fałszywy warunek nie trafia tutaj, inaczej tabela rosłaby
/// z każdym zdarzeniem zgłoszenia w systemie, nie z każdym uruchomieniem reguły. Licznik
/// wykonań z AUT-002 AC1 to <c>COUNT(*)</c> po tej tabeli z <see cref="Outcome"/> =
/// <see cref="AutomationRunOutcome.Executed"/>, patrz <see cref="AutomationRule"/>.
/// </summary>
public sealed class AutomationRun : AggregateRoot
{
    /// <summary>Wzorem <see cref="Issues.IssueActivity.MaxValueLength"/> — komunikat błędu jest
    /// diagnostyką dla operatora reguły, nie treścią bez granic.</summary>
    public const int MaxErrorMessageLength = 512;

    /// <summary>Konstruktor dla EF Core.</summary>
    private AutomationRun()
    {
    }

    private AutomationRun(
        Guid uuid,
        Guid ruleUuid,
        Guid issueUuid,
        AutomationRunOutcome outcome,
        string? errorMessage,
        DateTimeOffset occurredAt) : base(uuid)
    {
        RuleUuid = ruleUuid;
        IssueUuid = issueUuid;
        Outcome = outcome;
        ErrorMessage = errorMessage;
        OccurredAt = occurredAt;
    }

    public Guid RuleUuid { get; private set; }

    public Guid IssueUuid { get; private set; }

    public AutomationRunOutcome Outcome { get; private set; }

    public string? ErrorMessage { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public static AutomationRun RecordExecuted(Guid ruleUuid, Guid issueUuid, DateTimeOffset now)
        => new(Guid.CreateVersion7(), ruleUuid, issueUuid, AutomationRunOutcome.Executed, null, now);

    public static AutomationRun RecordFailed(Guid ruleUuid, Guid issueUuid, string errorMessage, DateTimeOffset now)
        => new(Guid.CreateVersion7(), ruleUuid, issueUuid, AutomationRunOutcome.Failed, Trim(errorMessage), now);

    private static string? Trim(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();

        return trimmed.Length > MaxErrorMessageLength ? trimmed[..MaxErrorMessageLength] : trimmed;
    }
}
