using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Sprints;
using TaskManagement.Domain.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Query;

/// <summary>Pojedynczy sprint.</summary>
public sealed class GetSprintEndpoint : Endpoint<GetSprintRequest, SprintDto>
{
    private readonly ISprintQueries _queries;

    public GetSprintEndpoint(ISprintQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getSprint");
        Group<SprintGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetSprintRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var sprint = await _queries.GetAsync(req.Uuid, ct)
            ?? throw new AggregateNotFoundException(nameof(Sprint), req.Uuid);

        await Send.OkAsync(sprint, ct);
    }
}
