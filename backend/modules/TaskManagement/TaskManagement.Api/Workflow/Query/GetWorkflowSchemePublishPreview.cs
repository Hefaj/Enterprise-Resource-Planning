using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

/// <summary>Podgląd skutków publikacji: dla stanów wskazanych do usunięcia pokazuje liczbę
/// zgłoszeń wymagających migracji i zbiór stanów-celów — ekran decyzji PRZED wysłaniem
/// <c>WorkflowSchemeExecPublishCommand</c> (WF-006).</summary>
public sealed class GetWorkflowSchemePublishPreviewEndpoint
    : Endpoint<GetWorkflowSchemePublishPreviewRequest, WorkflowSchemePublishPreviewDto>
{
    private readonly IWorkflowSchemePublishPreviewQueries _queries;

    public GetWorkflowSchemePublishPreviewEndpoint(IWorkflowSchemePublishPreviewQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getWorkflowSchemePublishPreview");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
    }

    public override async Task HandleAsync(GetWorkflowSchemePublishPreviewRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var preview = await _queries.PreviewAsync(req, ct);
        await Send.OkAsync(preview, ct);
    }
}
