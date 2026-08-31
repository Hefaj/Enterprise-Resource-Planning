using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.IssueTypes;

namespace TaskManagement.Application.IssueTypes;

/// <summary>Zakłada schemat typów zgłoszeń. Typy dokłada się osobno — wzorzec identyczny jak
/// <c>FieldSchemeCreateCommand</c>.</summary>
public sealed class IssueTypeSchemeCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class IssueTypeSchemeCreateCommandHandler : CommandHandler<IssueTypeSchemeCreateCommand, Guid>
{
    private readonly IIssueTypeSchemeRepository _schemes;

    public IssueTypeSchemeCreateCommandHandler(IIssueTypeSchemeRepository schemes) => _schemes = schemes;

    public override Task<Guid> ExecuteAsync(IssueTypeSchemeCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = IssueTypeScheme.CreateWithUuid(command.Uuid, command.Name, isSystem: false);
        _schemes.Add(scheme);

        return Task.FromResult(scheme.Uuid);
    }
}

/// <summary>
/// Dokłada typ zgłoszenia do schematu (TYP-001).
///
/// <para><see cref="Category"/> jest częścią komendy i decyduje o miejscu w hierarchii —
/// nie ma komendy zmieniającej kategorię istniejącego typu, tak samo jak nie ma zmiany slotu
/// pola: przemapowanie kategorii typu, który już ma zgłoszenia z rodzicami, złamałoby
/// niezmiennik jednorodzicielskiego drzewa.</para>
/// </summary>
public sealed class IssueTypeSchemeAddTypeCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid schematu.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Uuid zakładanego typu — nadaje go klient, jak przy każdym elemencie kolekcji
    /// zakładanym w trybie <c>Commands[]</c>.</summary>
    public Guid TypeUuid { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameKey { get; set; }

    public string Icon { get; set; } = string.Empty;

    public IssueTypeCategory Category { get; set; }

    public int OrderNo { get; set; }

    /// <summary>Nadpisanie automatu stanów projektu; puste = dziedziczenie (TYP-003 AC1).</summary>
    public Guid? WorkflowSchemeUuid { get; set; }

    /// <summary>Zawężenie zestawu pól projektu; puste = dziedziczenie (TYP-003 AC1).</summary>
    public Guid? FieldSchemeUuid { get; set; }
}

public sealed class IssueTypeSchemeAddTypeCommandHandler : CommandHandler<IssueTypeSchemeAddTypeCommand, Guid>
{
    private readonly IIssueTypeSchemeRepository _schemes;

    public IssueTypeSchemeAddTypeCommandHandler(IIssueTypeSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(IssueTypeSchemeAddTypeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueTypeScheme), command.Uuid);

        scheme.AddType(
            command.TypeUuid == Guid.Empty ? Entity.NewUuid() : command.TypeUuid,
            command.Code,
            command.Name,
            command.NameKey,
            command.Icon,
            command.Category,
            command.OrderNo,
            command.WorkflowSchemeUuid,
            command.FieldSchemeUuid);

        return scheme.Uuid;
    }
}

/// <summary>Nadpisuje szczegóły typu — nazwę, ikonę, kolejność i nadpisania schematów.
/// Kategoria pozostaje niezmienna (patrz <see cref="IssueTypeSchemeAddTypeCommand"/>).</summary>
public sealed class IssueTypeSchemeSetTypeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TypeUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? NameKey { get; set; }

    public string Icon { get; set; } = string.Empty;

    public int OrderNo { get; set; }

    public Guid? WorkflowSchemeUuid { get; set; }

    public Guid? FieldSchemeUuid { get; set; }
}

public sealed class IssueTypeSchemeSetTypeCommandHandler : CommandHandler<IssueTypeSchemeSetTypeCommand, Guid>
{
    private readonly IIssueTypeSchemeRepository _schemes;

    public IssueTypeSchemeSetTypeCommandHandler(IIssueTypeSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(IssueTypeSchemeSetTypeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueTypeScheme), command.Uuid);

        scheme.SetType(command.TypeUuid, command.Name, command.NameKey, command.Icon, command.OrderNo);
        scheme.SetTypeSchemeOverrides(command.TypeUuid, command.WorkflowSchemeUuid, command.FieldSchemeUuid);

        return scheme.Uuid;
    }
}

/// <summary>
/// Usuwa typ ze schematu.
///
/// <para>Odmawia, gdy <b>którekolwiek zgłoszenie ma ten typ</b> — sprawdzane przez
/// <see cref="IssueTypeInUseRule"/> w pre-checku operacji masowej (TYP-004 AC1). Handler
/// powtarza tę samą regułę jako drugą linię obrony, bo między pre-checkiem a wykonaniem
/// chunka mogło powstać nowe zgłoszenie tego typu (patrz <c>docs/backend/batch-validation.md</c>
/// §1.1 — pre-check to zapowiedź, nie gwarancja).</para>
/// </summary>
public sealed class IssueTypeSchemeRemoveTypeCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid TypeUuid { get; set; }
}

public sealed class IssueTypeSchemeRemoveTypeCommandHandler : CommandHandler<IssueTypeSchemeRemoveTypeCommand, Guid>
{
    private readonly IIssueTypeSchemeRepository _schemes;
    private readonly IIssueTypeUsageProbe _usage;

    public IssueTypeSchemeRemoveTypeCommandHandler(IIssueTypeSchemeRepository schemes, IIssueTypeUsageProbe usage)
    {
        _schemes = schemes;
        _usage = usage;
    }

    public override async Task<Guid> ExecuteAsync(IssueTypeSchemeRemoveTypeCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(IssueTypeScheme), command.Uuid);

        var type = scheme.FindByUuid(command.TypeUuid)
            ?? throw new AggregateNotFoundException(nameof(IssueType), command.TypeUuid);

        var usageCount = await _usage.CountByTypeAsync(command.TypeUuid, ct).ConfigureAwait(false);

        if (usageCount > 0)
        {
            throw new DomainException(
                "taskmgmt.issue_type_in_use",
                $"Typ `{type.Code}` jest użyty na {usageCount} zgłoszeniach — usunięcie jest niemożliwe.");
        }

        scheme.RemoveType(command.TypeUuid);

        return scheme.Uuid;
    }
}
