using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Załączniki zgłoszenia — zarówno obrazki wstawione w opis, jak i pliki dopięte obok.</summary>
public sealed class GetIssueAttachmentsEndpoint : Endpoint<GetIssueAttachmentsRequest, List<IssueAttachmentDto>>
{
    private readonly IIssueAttachmentQueries _queries;

    public GetIssueAttachmentsEndpoint(IIssueAttachmentQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueAttachments");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueAttachmentsRequest req, CancellationToken ct)
    {
        var attachments = await _queries.GetByIssueAsync(req.IssueUuid, ct);
        await Send.OkAsync(attachments, ct);
    }
}
