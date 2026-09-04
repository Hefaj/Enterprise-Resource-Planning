using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>
/// Nadpisuje <b>całą</b> kolekcję wartości pól niestandardowych zgłoszenia — człon w liczbie
/// mnogiej, więc to, co przyszło, jest tym, co zostaje, a pusta mapa czyści wszystkie pola
/// (<c>docs/guides/backend/endpoint-naming.md</c> §2).
///
/// <para>Wartości jadą jako <c>Dictionary&lt;string, string&gt;</c> w postaci kanonicznej,
/// a nie jako polimorficzny JSON: kontrakt NSwag musi mieć jeden typ na pole, a nie union
/// zależny od danych z bazy (<see cref="CustomFieldValue"/>).</para>
/// </summary>
public sealed class IssueSetCustomFieldsCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    /// <summary>Kod pola → wartość kanoniczna. Pole pominięte zostaje wyczyszczone.</summary>
    public Dictionary<string, string?> Values { get; set; } = [];
}

public sealed class IssueSetCustomFieldsCommandHandler : CommandHandler<IssueSetCustomFieldsCommand, Guid>
{
    private readonly IIssueRepository _issues;
    private readonly IFieldSchemeRepository _schemes;
    private readonly IIssueActivityWriter _activity;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueSetCustomFieldsCommandHandler(
        IIssueRepository issues,
        IFieldSchemeRepository schemes,
        IIssueActivityWriter activity,
        IExecutionContext executionContext,
        IClock clock)
    {
        _issues = issues;
        _schemes = schemes;
        _activity = activity;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueSetCustomFieldsCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var issue = await _issues.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.Uuid);

        var scheme = await _schemes.FindByProjectAsync(issue.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new DomainException(
                "taskmgmt.project_without_field_scheme",
                "Projekt tego zgłoszenia nie ma schematu pól — nie ma czego ustawiać.");

        var now = _clock.UtcNow;
        var previous = issue.CustomFields.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);

        issue.SetCustomFields(scheme, command.Values, now);

        // Historia dostaje wpis PER POLE, nie jeden zbiorczy: pytanie brzmi „kto zmienił
        // budżet", a nie „kto ruszał pola niestandardowe". Kod pola idzie surowy — zdanie
        // składa front z klucza tłumaczenia z profilu, tak samo jak przy polach wspólnych.
        var actor = IssueCreateCommandHandler.ActorUuid(_executionContext);

        foreach (var definition in scheme.Fields)
        {
            previous.TryGetValue(definition.Code, out var before);
            issue.CustomFields.TryGetValue(definition.Code, out var after);

            if (string.Equals(before, after, StringComparison.Ordinal))
            {
                continue;
            }

            _activity.Add(IssueActivity.Record(
                issue.Uuid,
                IssueActivityKind.FieldChanged,
                definition.Code,
                before,
                after,
                actor,
                _executionContext.CorrelationId,
                now));
        }

        return issue.Uuid;
    }
}
