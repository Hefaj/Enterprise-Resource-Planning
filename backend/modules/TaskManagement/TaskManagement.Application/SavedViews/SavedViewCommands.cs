using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.SavedViews;

namespace TaskManagement.Application.SavedViews;

/// <summary>
/// Zakłada zapisany widok (VIEW-001). Właściciel jest zawsze zalogowanym użytkownikiem —
/// tak samo jak zgłaszający zgłoszenia (<see cref="IssueCreateCommandHandler.ActorUuid"/>) —
/// nigdy polem z żądania, inaczej klient podstawiałby cudze widoki pod swoim kontem.
/// </summary>
public sealed class SavedViewCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tryb <c>Commands[]</c>.</summary>
    public Guid Uuid { get; set; }

    /// <summary><c>null</c> = widok prywatny; ustawiony = udostępniony temu projektowi.</summary>
    public Guid? ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Filtr listy zgłoszeń — nieprzejrzysty dla backendu (patrz <see cref="SavedView"/>).</summary>
    public string? FilterJson { get; set; }

    public string? SortJson { get; set; }

    public List<string>? Columns { get; set; }

    public SavedViewMode Mode { get; set; } = SavedViewMode.List;
}

public sealed class SavedViewCreateCommandHandler : CommandHandler<SavedViewCreateCommand, Guid>
{
    private readonly ISavedViewRepository _views;
    private readonly IExecutionContext _executionContext;

    public SavedViewCreateCommandHandler(ISavedViewRepository views, IExecutionContext executionContext)
    {
        _views = views;
        _executionContext = executionContext;
    }

    public override Task<Guid> ExecuteAsync(SavedViewCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var owner = IssueCreateCommandHandler.ActorUuid(_executionContext);

        var view = SavedView.CreateWithUuid(
            command.Uuid,
            owner,
            command.ProjectUuid,
            command.Name,
            command.FilterJson,
            command.SortJson,
            command.Columns,
            command.Mode);

        _views.Add(view);

        return Task.FromResult(view.Uuid);
    }
}

/// <summary>Nadpisuje treść widoku (nazwa, filtr, sortowanie, kolumny, tryb, udostępnienie
/// projektowi). Tylko właściciel może zmienić swój widok — cudzy udostępniony widok jest
/// dla innych wyłącznie do odczytu (VIEW-001 AC1); to jest reguła egzekwowana tutaj, w handlerze,
/// bo potrzebuje tożsamości wołającego, której agregat nie zna.</summary>
public sealed class SavedViewSetCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? FilterJson { get; set; }

    public string? SortJson { get; set; }

    public List<string>? Columns { get; set; }

    public SavedViewMode Mode { get; set; } = SavedViewMode.List;
}

public sealed class SavedViewSetCommandHandler : CommandHandler<SavedViewSetCommand, Guid>
{
    private readonly ISavedViewRepository _views;
    private readonly IExecutionContext _executionContext;

    public SavedViewSetCommandHandler(ISavedViewRepository views, IExecutionContext executionContext)
    {
        _views = views;
        _executionContext = executionContext;
    }

    public override async Task<Guid> ExecuteAsync(SavedViewSetCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var view = await _views.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(SavedView), command.Uuid);

        SavedViewOwnership.EnsureOwner(view, IssueCreateCommandHandler.ActorUuid(_executionContext));

        view.Set(
            command.ProjectUuid,
            command.Name,
            command.FilterJson,
            command.SortJson,
            command.Columns,
            command.Mode);

        return view.Uuid;
    }
}

/// <summary>Usuwa zapisany widok. Tylko właściciel — z tego samego powodu, co przy
/// <see cref="SavedViewSetCommand"/>.</summary>
public sealed class SavedViewRemoveCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class SavedViewRemoveCommandHandler : CommandHandler<SavedViewRemoveCommand, Guid>
{
    private readonly ISavedViewRepository _views;
    private readonly IExecutionContext _executionContext;

    public SavedViewRemoveCommandHandler(ISavedViewRepository views, IExecutionContext executionContext)
    {
        _views = views;
        _executionContext = executionContext;
    }

    public override async Task<Guid> ExecuteAsync(SavedViewRemoveCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var view = await _views.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(SavedView), command.Uuid);

        SavedViewOwnership.EnsureOwner(view, IssueCreateCommandHandler.ActorUuid(_executionContext));

        _views.Remove(view);

        return view.Uuid;
    }
}

/// <summary>
/// Kopiuje cudzy (albo własny) widok „do siebie” jednym kliknięciem (VIEW-001 AC1). To jest
/// wariant <c>Create</c>, nie osobny czasownik: <see cref="SourceUuid"/> służy WYŁĄCZNIE do
/// odczytania danych źródłowych po stronie handlera — kopia zawsze powstaje jako nowy, prywatny
/// widok wołającego, z nowym <see cref="Uuid"/> wygenerowanym przez klienta (tryb
/// <c>Commands[]</c>, tak jak przy zwykłym <see cref="SavedViewCreateCommand"/>).
/// </summary>
public sealed class SavedViewCreateCopyCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid nowej kopii, generowany przez klienta.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Widok źródłowy — musi istnieć; własność źródła NIE jest sprawdzana, bo kopiowanie
    /// cudzego udostępnionego widoku jest właśnie po to, żeby dało się z niego skorzystać bez
    /// prawa do edycji oryginału.</summary>
    public Guid SourceUuid { get; set; }

    /// <summary>Nazwa kopii; puste = nazwa źródła bez zmian.</summary>
    public string? Name { get; set; }
}

public sealed class SavedViewCreateCopyCommandHandler : CommandHandler<SavedViewCreateCopyCommand, Guid>
{
    private readonly ISavedViewRepository _views;
    private readonly IExecutionContext _executionContext;

    public SavedViewCreateCopyCommandHandler(ISavedViewRepository views, IExecutionContext executionContext)
    {
        _views = views;
        _executionContext = executionContext;
    }

    public override async Task<Guid> ExecuteAsync(SavedViewCreateCopyCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var source = await _views.FindAsync(command.SourceUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(SavedView), command.SourceUuid);

        var owner = IssueCreateCommandHandler.ActorUuid(_executionContext);

        // Kopia jest ZAWSZE prywatna (ProjectUuid = null), nawet gdy źródło było udostępnione
        // projektowi — „do siebie” znaczy do siebie, nie ponowne udostępnienie tego samego
        // projektowi pod nowym uuid.
        var copy = SavedView.CreateWithUuid(
            command.Uuid,
            owner,
            null,
            string.IsNullOrWhiteSpace(command.Name) ? source.Name : command.Name,
            source.FilterJson,
            source.SortJson,
            source.Columns,
            source.Mode);

        _views.Add(copy);

        return copy.Uuid;
    }
}

/// <summary>Wspólna reguła własności dla komend modyfikujących istniejący widok — wydzielona,
/// żeby <see cref="SavedViewSetCommandHandler"/> i <see cref="SavedViewRemoveCommandHandler"/>
/// nie rozjeżdżały się w komunikacie błędu.</summary>
internal static class SavedViewOwnership
{
    public static void EnsureOwner(SavedView view, Guid actorUuid)
    {
        if (view.OwnerUserUuid != actorUuid)
        {
            throw new DomainException(
                "taskmgmt.saved_view_not_owner",
                "Tylko właściciel może zmieniać ten widok — cudzy udostępniony widok jest "
                + "dostępny wyłącznie do odczytu.");
        }
    }
}
