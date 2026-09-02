using TaskManagement.Application.FieldSchemes;
using TaskManagement.Application.Issues;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Podgląd przeniesienia projektu — kompozycja dwóch istniejących odczytów, bez
/// własnego zapytania do bazy (<see cref="IIssueMoveToProjectPreviewQueries"/>).</summary>
public sealed class IssueMoveToProjectPreviewQueries : IIssueMoveToProjectPreviewQueries
{
    private readonly IIssueQueries _issueQueries;
    private readonly IFieldSchemeQueries _fieldSchemeQueries;

    public IssueMoveToProjectPreviewQueries(IIssueQueries issueQueries, IFieldSchemeQueries fieldSchemeQueries)
    {
        _issueQueries = issueQueries;
        _fieldSchemeQueries = fieldSchemeQueries;
    }

    /// <inheritdoc />
    public async Task<IssueMoveToProjectPreviewDto> PreviewAsync(
        IssueMoveToProjectPreviewRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var issues = await _issueQueries.GetAsync(request.IssueUuids, cancellationToken).ConfigureAwait(false);
        var targetProfile = await _fieldSchemeQueries
            .GetProjectProfileAsync(request.TargetProjectUuid, cancellationToken)
            .ConfigureAwait(false);

        var targetCodes = new HashSet<string>(targetProfile.Fields.Select(f => f.Code), StringComparer.Ordinal);

        var unmatched = issues
            .SelectMany(i => i.CustomFields.Keys)
            .Where(code => !targetCodes.Contains(code))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(code => code, StringComparer.Ordinal)
            .ToList();

        var options = targetProfile.Fields
            .Select(f => new IssueMoveToProjectFieldOptionDto(f.Code, f.Name))
            .ToList();

        return new IssueMoveToProjectPreviewDto(unmatched, options);
    }
}
