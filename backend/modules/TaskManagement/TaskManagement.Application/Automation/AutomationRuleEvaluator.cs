using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Automation.Conditions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Automation;

/// <summary>Ewaluuje i wykonuje reguły automatyzacji dla jednego wyzwalacza (AUT-001) —
/// wołane przez <c>AutomationTriggerHandler</c> z konsumenta outboxu.</summary>
public interface IAutomationRuleEvaluator
{
    Task EvaluateAsync(IssueAutomationTriggerRequested trigger, CancellationToken cancellationToken);
}

/// <summary>
/// <inheritdoc cref="IAutomationRuleEvaluator"/>
///
/// <para><b>Nowy scope DI per regułę</b> (<see cref="ExecuteRuleAsync"/>), wzorem
/// <c>IssueOverdueScanService</c>/<c>BulkCommandRunner</c> — nie oszczędność, konieczność: gdyby
/// akcje nieudanej reguły zostały śledzone przez ten sam <c>DbContext</c> bez zapisu, kolejna
/// reguła w tej samej pętli odczytałaby zgłoszenie z częściowo zmutowanym, niezapisanym stanem
/// zamiast z tego, co naprawdę jest w bazie. Fresh <c>DbContext</c> per reguła eliminuje to przez
/// konstrukcję — nieudana reguła po prostu nigdy nie woła <c>SaveChanges</c> na swoim kontekście,
/// a kontekst znika razem ze scope'em.</para>
/// </summary>
public sealed partial class AutomationRuleEvaluator : IAutomationRuleEvaluator
{
    /// <summary>Twardy limit głębokości łańcucha (AUT-001 AC3) — reguła wywołująca samą siebie
    /// (albo cykl A→B→A) zatrzymuje się tutaj, nie zjada instancji.</summary>
    public const int MaxChainDepth = 5;

    private readonly IAutomationRuleRepository _rules;
    private readonly IIssueRepository _issues;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AutomationRuleEvaluator> _logger;

    public AutomationRuleEvaluator(
        IAutomationRuleRepository rules,
        IIssueRepository issues,
        IServiceScopeFactory scopeFactory,
        ILogger<AutomationRuleEvaluator> logger)
    {
        _rules = rules;
        _issues = issues;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task EvaluateAsync(IssueAutomationTriggerRequested trigger, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(trigger);

        if (trigger.AutomationDepth >= MaxChainDepth)
        {
            LogChainDepthExceeded(_logger, trigger.IssueUuid, trigger.AutomationDepth);
            return;
        }

        var candidateRules = await _rules
            .FindEnabledByTriggerAsync(trigger.ProjectUuid, trigger.TriggerKind, cancellationToken)
            .ConfigureAwait(false);

        foreach (var rule in candidateRules)
        {
            // Zawsze świeży odczyt — po ewentualnym zapisie poprzedniej reguły w tej samej pętli
            // (patrz komentarz przy klasie).
            var issue = await _issues.FindAsync(trigger.IssueUuid, cancellationToken).ConfigureAwait(false);

            if (issue is null)
            {
                return;
            }

            var condition = AutomationConditionSerializer.Deserialize(rule.ConditionJson);

            if (!AutomationConditionEvaluator.Evaluate(condition, AutomationIssueSnapshot.Of(issue)))
            {
                continue;
            }

            await ExecuteRuleAsync(rule.Uuid, rule.Name, trigger.IssueUuid, trigger.AutomationDepth, cancellationToken)
                .ConfigureAwait(false);
        }
    }

    private async Task ExecuteRuleAsync(Guid ruleUuid, string ruleName, Guid issueUuid, int depth, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var services = scope.ServiceProvider;

        var rules = services.GetRequiredService<IAutomationRuleRepository>();
        var issues = services.GetRequiredService<IIssueRepository>();
        var runs = services.GetRequiredService<IAutomationRunWriter>();
        var unitOfWork = services.GetRequiredService<IUnitOfWork>();
        var dispatcher = services.GetRequiredService<ICommandDispatcher>();
        var actionExecutor = services.GetRequiredService<AutomationActionExecutor>();
        var clock = services.GetRequiredService<IClock>();

        // Rzutowanie z tego samego powodu co w `ExecutionContextMiddleware` — rejestracja jest
        // typ→interfejs, więc do settera dochodzi się przez konkretny typ. Bez niego scope po
        // prostu wykona akcje z pustym kontekstem (bez korelacji ani znacznika automatyzacji).
        if (services.GetRequiredService<IExecutionContext>() is MutableExecutionContext executionContext)
        {
            // Własna korelacja per regułę (AUT-001 AC2) — nie ta z komendy, która wyzwoliła trigger.
            executionContext.Set(userId: null, clientId: null, correlationId: Guid.CreateVersion7());
            executionContext.SetAutomation(ruleUuid, depth);
        }

        try
        {
            var rule = await rules.FindAsync(ruleUuid, ct).ConfigureAwait(false);
            var issue = await issues.FindAsync(issueUuid, ct).ConfigureAwait(false);

            if (rule is null || issue is null || !rule.IsEnabled)
            {
                // Wyścig: reguła wyłączona/usunięta albo zgłoszenie zniknęło między ewaluacją
                // warunku a tym momentem — nic do zrobienia, nie jest to błąd wykonania.
                return;
            }

            using (dispatcher.OwnTransaction())
            {
                foreach (var action in rule.Actions.OrderBy(a => a.OrderNo))
                {
                    await actionExecutor.ExecuteAsync(action, issue, ruleName, ct).ConfigureAwait(false);
                }
            }

            runs.Add(AutomationRun.RecordExecuted(ruleUuid, issueUuid, clock.UtcNow));
            await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Wyjątek z JEDNEJ reguły nie przerywa ewaluacji pozostałych reguł tego wyzwalacza —
            // błąd konfiguracji jednej automatyzacji nie może uciszyć wszystkich innych. Log
            // zapisujemy w ŚWIEŻYM scope'ie (ten powyżej mógł mieć nieużyteczny DbContext po
            // wyjątku w trakcie transakcji) — prostsze niż próba odzyskania tego samego kontekstu.
            await RecordFailureAsync(ruleUuid, issueUuid, ex, ct).ConfigureAwait(false);
            LogRuleFailed(_logger, ruleUuid, ex);
        }
    }

    private async Task RecordFailureAsync(Guid ruleUuid, Guid issueUuid, Exception ex, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var runs = scope.ServiceProvider.GetRequiredService<IAutomationRunWriter>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        runs.Add(AutomationRun.RecordFailed(ruleUuid, issueUuid, ex.Message, clock.UtcNow));
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning,
        Message = "Automatyzacja: zgłoszenie {IssueUuid} przekroczyło limit głębokości łańcucha ({Depth}) — ewaluacja przerwana.")]
    private static partial void LogChainDepthExceeded(ILogger logger, Guid issueUuid, int depth);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning, Message = "Reguła automatyzacji {RuleUuid} nie wykonała się.")]
    private static partial void LogRuleFailed(ILogger logger, Guid ruleUuid, Exception ex);
}
