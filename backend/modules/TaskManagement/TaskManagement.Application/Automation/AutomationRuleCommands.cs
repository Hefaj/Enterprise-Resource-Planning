using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Automation.Conditions;

namespace TaskManagement.Application.Automation;

/// <summary>Zakłada regułę automatyzacji (AUT-001). Warunek jest walidowany PRZED zapisem
/// (<see cref="AutomationConditionValidator"/>) — pole spoza whitelisty albo operator niepasujący
/// do rodzaju pola odpada tu, nie przy pierwszym uruchomieniu reguły w produkcji.</summary>
public sealed class AutomationRuleCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tryb <c>Commands[]</c>.</summary>
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public AutomationTriggerKind TriggerKind { get; set; }

    /// <summary>Grupy OR z porównaniami AND wewnątrz — pusta/<c>null</c> lista znaczy „zawsze".</summary>
    public List<List<AutomationComparison>>? ConditionGroups { get; set; }

    public List<AutomationActionRequest> Actions { get; set; } = [];
}

public sealed class AutomationRuleCreateCommandHandler : CommandHandler<AutomationRuleCreateCommand, Guid>
{
    private readonly IAutomationRuleRepository _rules;
    private readonly IClock _clock;

    public AutomationRuleCreateCommandHandler(IAutomationRuleRepository rules, IClock clock)
    {
        _rules = rules;
        _clock = clock;
    }

    public override Task<Guid> ExecuteAsync(AutomationRuleCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var condition = new AutomationCondition(ToGroups(command.ConditionGroups));
        AutomationConditionValidator.Validate(condition);

        var rule = AutomationRule.CreateWithUuid(
            command.Uuid,
            command.ProjectUuid,
            command.Name,
            command.TriggerKind,
            AutomationConditionSerializer.Serialize(condition),
            ToActions(command.Uuid, command.Actions),
            _clock.UtcNow);

        _rules.Add(rule);

        return Task.FromResult(rule.Uuid);
    }

    internal static IReadOnlyList<IReadOnlyList<AutomationComparison>> ToGroups(
        List<List<AutomationComparison>>? groups)
        => groups?.ConvertAll(g => (IReadOnlyList<AutomationComparison>)g) ?? [];

    internal static List<AutomationAction> ToActions(Guid ruleUuid, List<AutomationActionRequest> actions)
        => actions.ConvertAll(a => AutomationAction.Create(a.Uuid, ruleUuid, a.Kind, a.ConfigJson, a.OrderNo));
}

/// <summary>Nadpisuje całą treść reguły naraz — wzorem <c>SavedView.Set</c>.</summary>
public sealed class AutomationRuleSetCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public AutomationTriggerKind TriggerKind { get; set; }

    public List<List<AutomationComparison>>? ConditionGroups { get; set; }

    public List<AutomationActionRequest> Actions { get; set; } = [];
}

public sealed class AutomationRuleSetCommandHandler : CommandHandler<AutomationRuleSetCommand, Guid>
{
    private readonly IAutomationRuleRepository _rules;

    public AutomationRuleSetCommandHandler(IAutomationRuleRepository rules) => _rules = rules;

    public override async Task<Guid> ExecuteAsync(AutomationRuleSetCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var rule = await _rules.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(AutomationRule), command.Uuid);

        var condition = new AutomationCondition(AutomationRuleCreateCommandHandler.ToGroups(command.ConditionGroups));
        AutomationConditionValidator.Validate(condition);

        rule.Set(
            command.Name,
            command.TriggerKind,
            AutomationConditionSerializer.Serialize(condition),
            AutomationRuleCreateCommandHandler.ToActions(rule.Uuid, command.Actions));

        return rule.Uuid;
    }
}

/// <summary>Włącza regułę bez zmiany treści (AUT-002 AC1).</summary>
public sealed class AutomationRuleExecEnableCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class AutomationRuleExecEnableCommandHandler : CommandHandler<AutomationRuleExecEnableCommand, Guid>
{
    private readonly IAutomationRuleRepository _rules;

    public AutomationRuleExecEnableCommandHandler(IAutomationRuleRepository rules) => _rules = rules;

    public override async Task<Guid> ExecuteAsync(AutomationRuleExecEnableCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var rule = await _rules.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(AutomationRule), command.Uuid);

        rule.Enable();

        return rule.Uuid;
    }
}

/// <summary>Wyłącza regułę <b>bez usuwania</b> (AUT-002 AC1) — log i licznik zostają nietknięte,
/// odczytywalne, gdyby ktoś chciał ją później włączyć z powrotem.</summary>
public sealed class AutomationRuleExecDisableCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class AutomationRuleExecDisableCommandHandler : CommandHandler<AutomationRuleExecDisableCommand, Guid>
{
    private readonly IAutomationRuleRepository _rules;

    public AutomationRuleExecDisableCommandHandler(IAutomationRuleRepository rules) => _rules = rules;

    public override async Task<Guid> ExecuteAsync(AutomationRuleExecDisableCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var rule = await _rules.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(AutomationRule), command.Uuid);

        rule.Disable();

        return rule.Uuid;
    }
}

public sealed class AutomationRuleRemoveCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class AutomationRuleRemoveCommandHandler : CommandHandler<AutomationRuleRemoveCommand, Guid>
{
    private readonly IAutomationRuleRepository _rules;

    public AutomationRuleRemoveCommandHandler(IAutomationRuleRepository rules) => _rules = rules;

    public override async Task<Guid> ExecuteAsync(AutomationRuleRemoveCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var rule = await _rules.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(AutomationRule), command.Uuid);

        _rules.Remove(rule);

        return rule.Uuid;
    }
}
