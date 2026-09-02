using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.SavedViews;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.SavedViews.Command;

/// <summary>Kopiuje widok „do siebie" jednym kliknięciem (VIEW-001 AC1). Wariant <c>Create</c> —
/// <c>SourceUuid</c> w treści komendy służy tylko do odczytu danych źródłowych po stronie
/// handlera, więc endpoint dziedziczy po tej samej bazie co zwykłe zakładanie.</summary>
public sealed class SavedViewCreateCopyMultipleCommandEndpoint
    : CreateBatchEndpointBase<SavedViewCreateCopyCommand, SearchSavedViewRequest>
{
    public override void Configure()
    {
        Post("batch-copy");
        Group<SavedViewGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Kopiuje zapisany widok do siebie"));
    }
}
