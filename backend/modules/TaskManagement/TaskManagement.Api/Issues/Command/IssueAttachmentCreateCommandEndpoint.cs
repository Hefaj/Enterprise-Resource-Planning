using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.Options;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Żądanie rejestracji wgranych plików.</summary>
public sealed class IssueAttachmentCreateRequest
{
    public List<IssueAttachmentCreateCommand> Commands { get; set; } = [];
}

/// <summary>Identyfikatory założonych załączników, w kolejności żądania.</summary>
public sealed record IssueAttachmentCreateResponse(List<Guid> Uuids);

/// <summary>
/// Rejestruje pliki wgrane wcześniej prosto do magazynu.
///
/// <para><b>Dlaczego to NIE jest endpoint wsadowy</b>, mimo że przyjmuje listę — trzeci taki
/// wyjątek w systemie, po <c>ReportRunCreateCommandEndpoint</c> i <c>MultimediaCreateCommandEndpoint</c>.
/// Zadanie masowe kupuje postęp, sukces częściowy i odporność na restart; tutaj żadna z tych
/// rzeczy nie ma nabywcy. Kosztowny etap — transfer bajtów — już się odbył po stronie
/// przeglądarki, zostaje wstawienie kilku wierszy, a użytkownik patrzy w edytor i czeka.</para>
///
/// <para><b>Rozstrzygające jest jednak co innego: edytor potrzebuje uuidów NATYCHMIAST.</b>
/// Zaraz po wgraniu wstawia w treść <c>&lt;img&gt;</c> wskazujący na endpoint zawartości —
/// a ten adres zawiera uuid załącznika. Gdyby rejestracja szła przez zadanie, klient dostałby
/// <c>jobUuid</c> i musiałby odpytywać o zakończenie, zanim w ogóle mógłby wstawić obrazek
/// w miejsce, w którym użytkownik postawił kursor.</para>
/// </summary>
public sealed class IssueAttachmentCreateCommandEndpoint
    : Endpoint<IssueAttachmentCreateRequest, IssueAttachmentCreateResponse>
{
    private readonly ICommandDispatcher _dispatcher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IssueAttachmentOptions _options;

    public IssueAttachmentCreateCommandEndpoint(
        ICommandDispatcher dispatcher,
        IUnitOfWork unitOfWork,
        IOptions<IssueAttachmentOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _dispatcher = dispatcher;
        _unitOfWork = unitOfWork;
        _options = options.Value;
    }

    public override void Configure()
    {
        Post("attachment-create");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d
            .WithSummary("Rejestracja wgranych załączników zgłoszenia")
            .WithDescription(
                "Zakłada wpisy dla plików wgranych przez adresy z "
                + "`issue/getIssueAttachmentUploadTickets` i zwraca ich identyfikatory. "
                + "Wszystko albo nic: plik, który nie dotarł do magazynu, odrzuca całe żądanie."));
    }

    public override async Task HandleAsync(IssueAttachmentCreateRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        // Ta sama granica, co przy wydawaniu biletów — obie biorą się z jednej opcji, żeby nie
        // dało się dostać większej paczki biletów, niż wolno zarejestrować.
        if (req.Commands.Count == 0 || req.Commands.Count > _options.MaxFilesPerRequest)
        {
            AddError(r => r.Commands, $"Liczba plików musi mieścić się w zakresie 1–{_options.MaxFilesPerRequest}.");
            ThrowIfAnyErrors();
        }

        var uuids = new List<Guid>(req.Commands.Count);

        // Jedna transakcja na całą paczkę: granicę przejmuje endpoint, więc pipeline nie
        // zatwierdza po każdym pliku. Treść, w której wylądowała połowa wklejonych zrzutów,
        // byłaby gorsza niż odrzucenie całości.
        using (_dispatcher.OwnTransaction())
        {
            foreach (var command in req.Commands)
            {
                uuids.Add(await _dispatcher.SendAsync<IssueAttachmentCreateCommand, Guid>(command, ct));
            }

            await _unitOfWork.SaveChangesAsync(ct);
        }

        await Send.OkAsync(new IssueAttachmentCreateResponse(uuids), ct);
    }
}
