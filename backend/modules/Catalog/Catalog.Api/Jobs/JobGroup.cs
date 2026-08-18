using FastEndpoints;

namespace Catalog.Jobs;

/// <summary>
/// Sterowanie zadaniami masowymi wykonywanymi przez Catalog. Zamierzenie ODRĘBNE od
/// modułu Notification: tam <c>job/searchJob</c>/<c>getJob</c> czytają replikę do odczytu,
/// tutaj <c>job/cancel</c>/<c>job/retry-failed</c> działają na PRAWDZIWYCH danych zadania
/// (Catalog jest jego właścicielem) — patrz uzasadnienie własności w
/// <c>Erp.BuildingBlocks.Api.Contracts.JobCancelEndpointBase</c>.
/// </summary>
public class JobGroup : Group
{
    public JobGroup()
    {
        Configure("job", ep =>
        {
        });
    }
}
