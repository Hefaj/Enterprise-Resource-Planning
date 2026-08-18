using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Jobs;

/// <summary>Anulowanie zadania masowego Catalogu.</summary>
public sealed class JobCancelEndpoint : JobCancelEndpointBase<CatalogDbContext>
{
    public override void Configure()
    {
        // Bez powtórzenia prefiksu "job/" w ścieżce — w przeciwieństwie do
        // `product/product/batch-set-price`, gdzie podwojenie utrwalił już wygenerowany
        // klient frontendowy. Tu kontrakt jest nowy, więc od razu w czystej formie: `/job/cancel`.
        Post("cancel");
        Group<JobGroup>();
        Permissions(P.Catalog.JobControl);
    }
}

/// <summary>Ponowienie nieudanych elementów zadania masowego Catalogu.</summary>
public sealed class JobRetryFailedEndpoint : JobRetryFailedEndpointBase<CatalogDbContext>
{
    public override void Configure()
    {
        Post("retry-failed");
        Group<JobGroup>();
        Permissions(P.Catalog.JobControl);
    }
}
