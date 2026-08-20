using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Identity.Infrastructure.Persistence;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Identity.Jobs;

/// <summary>Anulowanie zadania masowego Identity.</summary>
public sealed class JobCancelEndpoint : JobCancelEndpointBase<IdentityDbContext>
{
    public override void Configure()
    {
        Post("cancel");
        Group<JobGroup>();
        Permissions(P.Identity.JobControl);
    }
}

/// <summary>Ponowienie nieudanych elementów zadania masowego Identity.</summary>
public sealed class JobRetryFailedEndpoint : JobRetryFailedEndpointBase<IdentityDbContext>
{
    public override void Configure()
    {
        Post("retry-failed");
        Group<JobGroup>();
        Permissions(P.Identity.JobControl);
    }
}
