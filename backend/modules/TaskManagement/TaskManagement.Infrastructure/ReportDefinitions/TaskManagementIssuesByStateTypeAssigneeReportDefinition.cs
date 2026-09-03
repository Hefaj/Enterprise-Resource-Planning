using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Zgłoszenia wg stanu/typu/przypisanego (RPT-003, `Should`) — pierwsza z czterech definicji
/// startowego zestawu, obok już zrealizowanego <c>hours-by-department</c> (RPT-002, `Must`).
///
/// <para>Czysta liczność: wiersz to krotka (projekt, stan, typ, przypisany) i licznik zgłoszeń
/// w tej krotce. <b>PERM-005 AC2/AC3</b> — ten sam wzorzec co <c>HoursByDepartmentRow</c>:
/// <see cref="Row"/> nie ma pola na tytuł ani opis, więc granica jest wymuszona kształtem DTO,
/// nie filtrem w warstwie wyżej.</para>
///
/// <para>Stan wraca jako <c>state_code</c> (nie nazwa) i typ jako <c>type_uuid</c>/<c>type_name</c>
/// (nazwa pierwszej klasy z <c>FLD-002</c>) — front rozwiązuje kod stanu na etykietę przez
/// tłumaczenie (<see cref="TaskManagement.Domain.Workflow.WorkflowState.NameKey"/> jest kluczem,
/// nie tekstem), tak jak robi to już tabela zgłoszeń.</para>
/// </summary>
public sealed class TaskManagementIssuesByStateTypeAssigneeReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.issues-by-state-type-assignee";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementIssuesByStateTypeAssigneeReportDefinition(TaskManagementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    /// <remarks>Bez zakresu dat — to jest przekrój bieżącego stanu zgłoszeń, nie okresu, więc
    /// nie ma naturalnego progu odmowy poza samą liczbą zgłoszeń w systemie (dziś nieograniczoną,
    /// tak jak eksport Catalogu).</remarks>
    public Task<ReportEstimate> EstimateAsync(ReportParameters parameters, CancellationToken cancellationToken)
        => Task.FromResult(ReportEstimate.Unbounded);

    /// <inheritdoc />
    public async IAsyncEnumerable<ReportRow> StreamAsync(
        ReportParameters parameters,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var filter = ParseParameters(parameters);
        var projectUuids = filter.ProjectUuids ?? [];

        var grouped = _dbContext.Issues
            .AsNoTracking()
            .Where(i => projectUuids.Length == 0 || projectUuids.Contains(i.ProjectUuid))
            .GroupBy(i => new { i.ProjectUuid, i.StateUuid, i.TypeUuid, i.AssigneeUuid })
            .Select(g => new
            {
                g.Key.ProjectUuid,
                g.Key.StateUuid,
                g.Key.TypeUuid,
                g.Key.AssigneeUuid,
                Count = g.Count(),
            });

        var source = from g in grouped
                     join p in _dbContext.Projects.AsNoTracking() on g.ProjectUuid equals p.Uuid
                     join s in _dbContext.WorkflowStates.AsNoTracking() on g.StateUuid equals s.Uuid
                     join t in _dbContext.IssueTypes.AsNoTracking() on g.TypeUuid equals t.Uuid
                     orderby p.Code, s.Code, t.Name
                     select new Row(p.Code, s.Code, t.Uuid, t.Name, g.AssigneeUuid, g.Count);

        await foreach (var row in source.AsAsyncEnumerable().WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("project_code", row.ProjectCode),
                ("state_code", row.StateCode),
                ("type_uuid", row.TypeUuid),
                ("type_name", row.TypeName),
                ("assignee_uuid", row.AssigneeUuid),
                ("count", row.Count));
        }
    }

    private static Parameters ParseParameters(ReportParameters parameters)
    {
        if (string.IsNullOrWhiteSpace(parameters.ParametersJson))
        {
            return new Parameters(null);
        }

        return JsonSerializer.Deserialize<Parameters>(parameters.ParametersJson, JsonOptions)
            ?? new Parameters(null);
    }

    private sealed record Parameters(Guid[]? ProjectUuids);

    private sealed record Row(string ProjectCode, string StateCode, Guid TypeUuid, string TypeName, Guid? AssigneeUuid, int Count);
}
