using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Tags;

namespace TaskManagement.Application.Tags;

/// <summary>
/// Zakłada tag w locie (TAG-002) — kto wolno, decyduje uprawnienie na endpointcie
/// (<c>taskmgmt.tag.manage</c>), nie handler.
/// </summary>
public sealed class TagCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Color { get; set; }
}

public sealed class TagCreateCommandHandler : CommandHandler<TagCreateCommand, Guid>
{
    private readonly ITagRepository _tags;

    public TagCreateCommandHandler(ITagRepository tags) => _tags = tags;

    public override Task<Guid> ExecuteAsync(TagCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var tag = Tag.CreateWithUuid(command.Uuid, command.ProjectUuid, command.Name, command.Color);

        _tags.Add(tag);

        return Task.FromResult(tag.Uuid);
    }
}

/// <summary>Zmienia nazwę tagu (TAG-003, `Could`). Kolizja z tagiem o tej samej nazwie w tym
/// samym zasięgu jest odrzucana przez unikalny indeks bazy — dokładnie jak przy założeniu,
/// żaden dodatkowy pre-check nie jest tu potrzebny.</summary>
public sealed class TagSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class TagSetNameCommandHandler : CommandHandler<TagSetNameCommand, Guid>
{
    private readonly ITagRepository _tags;

    public TagSetNameCommandHandler(ITagRepository tags) => _tags = tags;

    public override async Task<Guid> ExecuteAsync(TagSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var tag = await _tags.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Tag), command.Uuid);

        tag.SetName(command.Name);

        return tag.Uuid;
    }
}

/// <summary>
/// Scala <see cref="Uuid"/> (tag źródłowy) w <see cref="TargetTagUuid"/> — czasownik <c>Exec</c>
/// (TAG-003, `Could`), bo operacja usuwa jeden agregat i przepina kolekcję należącą do
/// nieograniczonej liczby innych agregatów (<c>Issue</c>), więc nie da się jej opisać jako
/// <c>Create</c>/<c>Set</c>/<c>Add</c>/<c>Remove</c> na jednym z nich —
/// <c>docs/backend/endpoint-naming.md</c> §5.
///
/// <para><b>Bez `AggregateChanged` dla zgłoszeń dotkniętych scaleniem</b> — przepięcie
/// <c>issue_tag</c> idzie raw SQL-em (<see cref="IIssueTagWriter"/>), z pominięciem
/// ChangeTrackera, który generuje to zdarzenie. Świadomie zaakceptowane: front po scaleniu
/// przeładowuje listę tagów w całości, zamiast polegać na realtime pojedynczego zgłoszenia.</para>
/// </summary>
public sealed class TagExecMergeCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Tag źródłowy — po scaleniu przestaje istnieć.</summary>
    public Guid Uuid { get; set; }

    public Guid TargetTagUuid { get; set; }
}

public sealed class TagExecMergeCommandHandler : CommandHandler<TagExecMergeCommand, Guid>
{
    private readonly ITagRepository _tags;
    private readonly IIssueTagWriter _issueTags;

    public TagExecMergeCommandHandler(ITagRepository tags, IIssueTagWriter issueTags)
    {
        _tags = tags;
        _issueTags = issueTags;
    }

    public override async Task<Guid> ExecuteAsync(TagExecMergeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.Uuid == command.TargetTagUuid)
        {
            throw new DomainException("taskmgmt.tag_merge_same_tag", "Nie można scalić tagu z samym sobą.");
        }

        var source = await _tags.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Tag), command.Uuid);

        var target = await _tags.FindAsync(command.TargetTagUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Tag), command.TargetTagUuid);

        // Scalenie między zasięgami (tag projektowy → globalny albo między dwoma projektami)
        // przenosiłoby tag po cichu poza kontekst, w którym powstał — odrzucone jawnie, zamiast
        // dać administratorowi wynik, którego się nie spodziewał.
        if (source.ProjectUuid != target.ProjectUuid)
        {
            throw new DomainException(
                "taskmgmt.tag_merge_scope_mismatch",
                "Scalić można wyłącznie tagi z tego samego zasięgu (oba globalne albo oba tego samego projektu).");
        }

        await _issueTags.RepointAsync(source.Uuid, target.Uuid, ct).ConfigureAwait(false);

        _tags.Remove(source);

        return target.Uuid;
    }
}
