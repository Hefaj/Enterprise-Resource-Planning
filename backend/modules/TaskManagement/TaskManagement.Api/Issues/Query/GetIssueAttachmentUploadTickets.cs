using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Artifacts;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>
/// Wydaje adresy, pod które przeglądarka wgra pliki prosto do magazynu.
///
/// <para><b>Bajty nie idą przez ten serwis.</b> Zrzut ekranu wklejony do opisu bywa liczony
/// w megabajtach; przepuszczenie go przez endpoint modułu oznaczałoby żądanie HTTP trzymane
/// otwarte na czas transferu i drugi komplet bajtów przechodzący przez proces .NET bez żadnego
/// pożytku — magazyn i tak przyjmie je bezpośrednio.</para>
///
/// <para><b>Czego ten bilet NIE daje.</b> Uprawnia do zapisu pod JEDNYM identyfikatorem,
/// którego posiadacz i tak nie wybiera, i nie sięga po nic, co już w magazynie leży. Dopóki nie
/// przyjdzie komenda rejestrująca, wgrany obiekt jest niczyim śmieciem, a nie załącznikiem —
/// sprząta go reguła lifecycle na prefiksie postojowym.</para>
/// </summary>
public sealed class GetIssueAttachmentUploadTicketsEndpoint
    : Endpoint<GetIssueAttachmentUploadTicketsRequest, List<IssueAttachmentUploadTicketDto>>
{
    private readonly IArtifactStore _artifacts;
    private readonly IssueAttachmentOptions _options;
    private readonly ErpArtifactOptions _artifactOptions;

    public GetIssueAttachmentUploadTicketsEndpoint(
        // Magazyn trwały: załączniki mają przeżyć retencję eksportów.
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts,
        IOptions<IssueAttachmentOptions> options,
        IOptions<ErpArtifactOptions> artifactOptions)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(artifactOptions);

        _artifacts = artifacts;
        _options = options.Value;
        _artifactOptions = artifactOptions.Value;
    }

    public override void Configure()
    {
        Post("getIssueAttachmentUploadTickets");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d
            .WithSummary("Adresy do wgrania plików prosto do magazynu")
            .WithDescription(
                "Zwraca `count` jednorazowych adresów `PUT`. Po zakończonym transferze klient "
                + "rejestruje pliki komendą `issue/attachment-create`, podając otrzymane "
                + "`artifactUuid`."));
    }

    public override async Task HandleAsync(GetIssueAttachmentUploadTicketsRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        if (req.Count < 1 || req.Count > _options.MaxFilesPerRequest)
        {
            AddError(r => r.Count, $"Liczba plików musi mieścić się w zakresie 1–{_options.MaxFilesPerRequest}.");
            ThrowIfAnyErrors();
        }

        var tickets = new List<IssueAttachmentUploadTicketDto>(req.Count);

        for (var i = 0; i < req.Count; i++)
        {
            var ticket = await _artifacts.CreateUploadTicketAsync(_artifactOptions.UploadUrlTtl, ct);

            tickets.Add(new IssueAttachmentUploadTicketDto(
                ticket.Uuid,
                ticket.Url.ToString(),
                ticket.ExpiresOn.UtcDateTime));
        }

        await Send.OkAsync(tickets, ct);
    }
}
