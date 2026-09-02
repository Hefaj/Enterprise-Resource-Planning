using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Podgląd skutków przeniesienia zaznaczonych zgłoszeń do innego projektu — ekran
/// decyzji o polach bez odpowiednika PRZED wysłaniem komendy (ISS-010 AC4).</summary>
public sealed class GetIssueMoveToProjectPreviewEndpoint
    : Endpoint<IssueMoveToProjectPreviewRequest, IssueMoveToProjectPreviewDto>
{
    private readonly IIssueMoveToProjectPreviewQueries _queries;

    public GetIssueMoveToProjectPreviewEndpoint(IIssueMoveToProjectPreviewQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueMoveToProjectPreview");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
    }

    public override async Task HandleAsync(IssueMoveToProjectPreviewRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var preview = await _queries.PreviewAsync(req, ct);
        await Send.OkAsync(preview, ct);
    }
}
