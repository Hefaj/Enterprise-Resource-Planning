using FastEndpoints;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Query;

/// <summary>Pojedynczy schemat typów zgłoszeń — zakładka „Typy" na karcie projektu.</summary>
public sealed class GetIssueTypeSchemeEndpoint : Endpoint<GetIssueTypeSchemeRequest, IssueTypeSchemeDto?>
{
    private readonly IIssueTypeSchemeQueries _queries;

    public GetIssueTypeSchemeEndpoint(IIssueTypeSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueTypeScheme");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueTypeSchemeRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var scheme = await _queries.GetAsync(req.Uuid, ct);
        await Send.OkAsync(scheme, ct);
    }
}
