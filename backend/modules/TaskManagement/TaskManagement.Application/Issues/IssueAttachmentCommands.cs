using System.Globalization;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>Rejestracja pliku wgranego wcześniej prosto do magazynu przez bilet.</summary>
public sealed class IssueAttachmentCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid załącznika generowany przez klienta — potrzebny mu natychmiast, żeby
    /// wstawić obrazek w treść, zanim zapis opisu w ogóle wyruszy.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Zgłoszenie, do którego plik należy. Właściciel, nie referencja: to po nim
    /// idzie kaskadowe sprzątanie.</summary>
    public Guid IssueUuid { get; set; }

    /// <summary>Identyfikator z biletu wgrywania.</summary>
    public Guid ArtifactUuid { get; set; }

    public string FileName { get; set; } = string.Empty;
}

/// <summary>
/// Zakłada wpis dla pliku leżącego w poczekalni magazynu i przenosi go do zawartości potwierdzonej.
///
/// <para><b>Odczyt metadanych z magazynu jest walidacją, nie uzupełnianiem danych.</b> Bilet
/// jest bearer-owy i wydany z góry, więc do tego miejsca dochodzi żądanie wskazujące artefakt,
/// którego nikt nie wgrał — bo transfer padł, bo użytkownik zamknął kartę, albo bo ktoś zgadł
/// identyfikator. Brak obiektu w poczekalni to odmowa: wpis wskazujący na pustkę byłby w treści
/// zgłoszenia zepsutym obrazkiem bez żadnego wyjaśnienia.</para>
///
/// <para><b>Promocja idzie PRZED zatwierdzeniem transakcji.</b> Odwrotna kolejność zostawiałaby
/// przy awarii wiersz wskazujący na poczekalnię, którą lifecycle sprząta po dobie — czyli
/// zepsuty obrazek u użytkownika. Ta kolejność zostawia w najgorszym razie obiekt bez wiersza:
/// niewidoczny dla nikogo (<c>docs/guides/backend/media-storage.md</c> §4d).</para>
/// </summary>
public sealed class IssueAttachmentCreateCommandHandler : CommandHandler<IssueAttachmentCreateCommand, Guid>
{
    private readonly IIssueAttachmentRepository _repository;
    private readonly IIssueRepository _issues;
    private readonly IIssueActivityWriter _activity;
    private readonly IArtifactStore _artifacts;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;
    private readonly IssueAttachmentOptions _options;

    public IssueAttachmentCreateCommandHandler(
        IIssueAttachmentRepository repository,
        IIssueRepository issues,
        IIssueActivityWriter activity,
        // Magazyn trwały, nie domyślny: w domyślnym obowiązuje reguła wygasania, która skasowałaby
        // załączniki po kilku dniach (patrz ErpArtifactStoreOptions.RetentionDays).
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts,
        IExecutionContext executionContext,
        IClock clock,
        IOptions<IssueAttachmentOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _repository = repository;
        _issues = issues;
        _activity = activity;
        _artifacts = artifacts;
        _executionContext = executionContext;
        _clock = clock;
        _options = options.Value;
    }

    public override async Task<Guid> ExecuteAsync(IssueAttachmentCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Zgłoszenie musi istnieć ZANIM plik dostanie właściciela — inaczej klucz obcy odbiłby
        // się dopiero przy zapisie, po przeniesieniu pliku z poczekalni.
        _ = await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Issue), command.IssueUuid);

        var metadata = await _artifacts.GetStagedMetadataAsync(command.ArtifactUuid, ct).ConfigureAwait(false)
            ?? throw new DomainException(
                "taskmgmt.attachment_not_uploaded",
                "Plik nie dotarł do magazynu — wgraj go ponownie.");

        if (metadata.SizeBytes > _options.MaxFileSizeBytes)
        {
            // Plik już leży w poczekalni — lifecycle usunąłby go po dobie, ale nie ma powodu
            // trzymać przez ten czas czegoś, co właśnie zostało odrzucone.
            await _artifacts.DeleteStagedAsync(command.ArtifactUuid, ct).ConfigureAwait(false);

            throw new DomainException(
                "taskmgmt.attachment_file_too_large",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Plik ma {metadata.SizeBytes / 1024 / 1024} MB i przekracza limit "
                    + $"{_options.MaxFileSizeBytes / 1024 / 1024} MB."));
        }

        var actor = ActorUuid(_executionContext);
        var now = _clock.UtcNow;

        var attachment = IssueAttachment.CreateUploaded(
            command.Uuid,
            command.IssueUuid,
            command.ArtifactUuid,
            command.FileName,
            metadata.ContentType,
            metadata.SizeBytes,
            actor,
            now);

        _repository.Add(attachment);

        // Plik dopięty do zgłoszenia jest zdarzeniem w jego historii — na karcie czyta się to
        // razem ze zmianami pól i komentarzami, jednym strumieniem.
        _activity.Add(IssueActivity.Record(
            attachment.IssueUuid,
            IssueActivityKind.AttachmentAdded,
            fieldCode: null,
            oldValue: null,
            newValue: attachment.FileName,
            actor,
            _executionContext.CorrelationId,
            now));

        await _artifacts.PromoteAsync(command.ArtifactUuid, ct).ConfigureAwait(false);

        return attachment.Uuid;
    }

    private static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

/// <summary>Usunięcie pojedynczego załącznika (ATT-002) — zgłoszenie żyjące miesiącami musi dać
/// się posprzątać z omyłkowo wgranych plików.</summary>
public sealed class IssueRemoveAttachmentCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

/// <summary>
/// Kasuje wiersz załącznika i prosi magazyn o skasowanie pliku przez outbox — <b>nie gołym
/// wywołaniem <c>DeleteAsync</c> tutaj</b>. Baza i MinIO nie są w jednej transakcji: rollback tej
/// komendy nie może zostawić wiszącego wywołania do magazynu, a padnięcie magazynu nie może
/// zablokować usunięcia wiersza. <see cref="ArtifactDeletionRequested"/> idzie tą samą drogą,
/// co w Catalogu (<c>docs/guides/backend/media-storage.md</c> §4b) — konsument
/// (<c>ArtifactDeletionRequestedHandler</c>) woła <c>DeleteAsync</c> po zatwierdzeniu transakcji,
/// z ponowieniami, tolerując brak obiektu.
/// </summary>
public sealed class IssueRemoveAttachmentCommandHandler : CommandHandler<IssueRemoveAttachmentCommand, Guid>
{
    private readonly IIssueAttachmentRepository _repository;
    private readonly IIssueActivityWriter _activity;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    public IssueRemoveAttachmentCommandHandler(
        IIssueAttachmentRepository repository,
        IIssueActivityWriter activity,
        IIntegrationEventPublisher publisher,
        IExecutionContext executionContext,
        IClock clock)
    {
        _repository = repository;
        _activity = activity;
        _publisher = publisher;
        _executionContext = executionContext;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(IssueRemoveAttachmentCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var attachment = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueAttachment), command.Uuid);

        _repository.Remove(attachment);

        var actor = ActorUuid(_executionContext);
        var now = _clock.UtcNow;

        _activity.Add(IssueActivity.Record(
            attachment.IssueUuid,
            IssueActivityKind.AttachmentRemoved,
            fieldCode: null,
            oldValue: attachment.FileName,
            newValue: null,
            actor,
            _executionContext.CorrelationId,
            now));

        await _publisher.PublishAsync(
            new ArtifactDeletionRequested(TaskManagementModule.Name, ArtifactStoreKeys.Media, attachment.ArtifactUuid),
            ct).ConfigureAwait(false);

        return attachment.IssueUuid;
    }

    private static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

/// <summary>Limity wgrywania załączników; sekcja <c>Attachments</c> w appsettings.</summary>
public sealed class IssueAttachmentOptions
{
    public const string SectionName = "Attachments";

    /// <summary>Domyślnie 32 MB — zrzuty ekranu i dokumenty, nie materiał wideo.</summary>
    public long MaxFileSizeBytes { get; set; } = 32L * 1024 * 1024;

    /// <summary>Ile biletów wolno wydać jednym żądaniem. Nie chroni przed niczym groźnym —
    /// chroni przed wybiciem tysiąca podpisów, gdyby po drugiej stronie coś się zapętliło.</summary>
    public int MaxFilesPerRequest { get; set; } = 20;
}
