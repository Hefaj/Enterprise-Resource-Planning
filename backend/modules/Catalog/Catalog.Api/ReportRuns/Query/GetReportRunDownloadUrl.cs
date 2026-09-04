using Catalog.Application.Abstractions;
using Catalog.Application.ReportRuns;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Reporting;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ReportRuns.Query;

/// <summary>
/// Wydaje krótko ważny adres pobrania artefaktu.
///
/// <para><b>Dlaczego osobny endpoint, a nie pole w DTO.</b> Adres jest presigned, czyli
/// <b>bearer-owy</b>: kto go ma, ten pobiera, niezależnie od uprawnień. Gdyby jechał w każdym
/// <c>getReportRun</c>, leżałby w cache przeglądarki i w historii długo po tym, jak przestał
/// być komukolwiek potrzebny. Tutaj powstaje dopiero na kliknięcie, za sprawdzeniem uprawnienia,
/// i żyje minuty — patrz <c>docs/guides/backend/exports-artifacts.md</c> §6.</para>
/// </summary>
public sealed class GetReportRunDownloadUrlEndpoint
    : Endpoint<GetReportRunDownloadUrlRequest, ReportRunDownloadUrlResponse>
{
    /// <summary>Tyle, ile trzeba na kliknięcie i start pobierania — nie więcej.</summary>
    private static readonly TimeSpan LinkTtl = TimeSpan.FromMinutes(5);

    private readonly IReportRunRepository _repository;
    private readonly IArtifactStore _artifacts;
    private readonly IClock _clock;

    public GetReportRunDownloadUrlEndpoint(
        IReportRunRepository repository,
        IArtifactStore artifacts,
        IClock clock)
    {
        _repository = repository;
        _artifacts = artifacts;
        _clock = clock;
    }

    public override void Configure()
    {
        Post("getReportRunDownloadUrl");
        Group<ReportRunGroup>();
        Permissions(P.Catalog.ReportRunCreate);
    }

    public override async Task HandleAsync(GetReportRunDownloadUrlRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var run = await _repository.FindAsync(req.Uuid, ct);

        if (run is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (run.Status != ReportRunStatus.Completed || run.ArtifactUuid is null)
        {
            AddError(r => r.Uuid, "Przebieg raportu nie zakończył się powodzeniem — nie ma czego pobierać.");
            ThrowIfAnyErrors();
        }

        // Wygasły artefakt to nie 404 z magazynu, tylko świadoma odmowa: `job.expire_on`
        // jest źródłem prawdy o retencji, a polityka lifecycle w MinIO tylko sprząta po nim.
        if (run.ExpireOn is not null && run.ExpireOn <= _clock.UtcNow)
        {
            AddError(r => r.Uuid, "Artefakt wygasł i nie jest już dostępny.");
            ThrowIfAnyErrors();
        }

        var metadata = await _artifacts.GetMetadataAsync(run.ArtifactUuid!.Value, ct);

        if (metadata is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var url = await _artifacts.GetDownloadUrlAsync(run.ArtifactUuid.Value, LinkTtl, ct);

        await Send.OkAsync(
            new ReportRunDownloadUrlResponse(url.ToString(), metadata.FileName, _clock.UtcNow.Add(LinkTtl)),
            ct);
    }
}
