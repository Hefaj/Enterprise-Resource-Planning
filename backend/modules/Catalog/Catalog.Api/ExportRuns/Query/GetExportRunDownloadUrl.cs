using Catalog.Application.Abstractions;
using Catalog.Application.ExportRuns;
using Catalog.Domain.ExportRuns;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.ExportRuns.Query;

/// <summary>
/// Wydaje krótko ważny adres pobrania artefaktu.
///
/// <para><b>Dlaczego osobny endpoint, a nie pole w DTO.</b> Adres jest presigned, czyli
/// <b>bearer-owy</b>: kto go ma, ten pobiera, niezależnie od uprawnień. Gdyby jechał w każdym
/// <c>getExportRun</c>, leżałby w cache przeglądarki i w historii długo po tym, jak przestał
/// być komukolwiek potrzebny. Tutaj powstaje dopiero na kliknięcie, za sprawdzeniem uprawnienia,
/// i żyje minuty — patrz <c>docs/backend/exports-artifacts.md</c> §6.</para>
/// </summary>
public sealed class GetExportRunDownloadUrlEndpoint
    : Endpoint<GetExportRunDownloadUrlRequest, ExportRunDownloadUrlResponse>
{
    /// <summary>Tyle, ile trzeba na kliknięcie i start pobierania — nie więcej.</summary>
    private static readonly TimeSpan LinkTtl = TimeSpan.FromMinutes(5);

    private readonly IExportRunRepository _repository;
    private readonly IArtifactStore _artifacts;
    private readonly IClock _clock;

    public GetExportRunDownloadUrlEndpoint(
        IExportRunRepository repository,
        IArtifactStore artifacts,
        IClock clock)
    {
        _repository = repository;
        _artifacts = artifacts;
        _clock = clock;
    }

    public override void Configure()
    {
        Post("getExportRunDownloadUrl");
        Group<ExportRunGroup>();
        Permissions(P.Catalog.ExportRunCreate);
    }

    public override async Task HandleAsync(GetExportRunDownloadUrlRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var run = await _repository.FindAsync(req.Uuid, ct);

        if (run is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (run.Status != ExportRunStatus.Completed || run.ArtifactUuid is null)
        {
            AddError(r => r.Uuid, "Przebieg eksportu nie zakończył się powodzeniem — nie ma czego pobierać.");
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
            new ExportRunDownloadUrlResponse(url.ToString(), metadata.FileName, _clock.UtcNow.Add(LinkTtl)),
            ct);
    }
}
