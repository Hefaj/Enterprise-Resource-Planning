using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Boards;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Boards.Command;

/// <summary>Zakłada tablice — kolumny powstają z bieżącego schematu stanów projektu</summary>
public sealed class BoardCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<BoardCreateCommand, SearchBoardRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<BoardGroup>();
        Permissions(P.TaskManagement.BoardManage);
        Description(d => d.WithSummary("Zakłada tablice — kolumny powstają z bieżącego schematu stanów projektu"));
    }
}
