using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.FieldSchemes;

namespace TaskManagement.Application.FieldSchemes;

/// <summary>Zakłada schemat pól. Pola dokłada się osobno — <c>Create</c> z listą pól
/// wymagałby walidacji slotów w dwóch miejscach naraz.</summary>
public sealed class FieldSchemeCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class FieldSchemeCreateCommandHandler : CommandHandler<FieldSchemeCreateCommand, Guid>
{
    private readonly IFieldSchemeRepository _schemes;

    public FieldSchemeCreateCommandHandler(IFieldSchemeRepository schemes) => _schemes = schemes;

    public override Task<Guid> ExecuteAsync(FieldSchemeCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = FieldScheme.CreateWithUuid(command.Uuid, command.Name, isSystem: false);
        _schemes.Add(scheme);

        return Task.FromResult(scheme.Uuid);
    }
}

/// <summary>Nadpisuje nazwę schematu pól.</summary>
public sealed class FieldSchemeSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class FieldSchemeSetNameCommandHandler : CommandHandler<FieldSchemeSetNameCommand, Guid>
{
    private readonly IFieldSchemeRepository _schemes;

    public FieldSchemeSetNameCommandHandler(IFieldSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(FieldSchemeSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(FieldScheme), command.Uuid);

        scheme.SetName(command.Name);

        return scheme.Uuid;
    }
}

/// <summary>
/// Dokłada definicję pola do schematu.
///
/// <para><c>Slot</c> jest częścią komendy i <b>nie da się go później zmienić</b> — nie ma
/// komendy „przemapuj slot". To jest egzekucja reguły „mapowanie pole↔slot jest niezmienne
/// po pierwszym użyciu" (<c>docs/backend/task-management.md</c> §6): przemapowanie podmieniłoby
/// znaczenie danych historycznych, bo kolumna z budżetami zaczęłaby uchodzić za kolumnę
/// z liczbą godzin.</para>
/// </summary>
public sealed class FieldSchemeAddFieldCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid schematu.</summary>
    public Guid Uuid { get; set; }

    /// <summary>Uuid zakładanej definicji — nadaje go klient, jak przy każdym elemencie
    /// kolekcji zakładanym w trybie <c>Commands[]</c>.</summary>
    public Guid FieldUuid { get; set; }

    public string Code { get; set; } = string.Empty;

    /// <summary>Nazwa wpisana wprost przez użytkownika (<c>FLD-002</c>) — wymagana.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Klucz tłumaczenia — opcjonalny, tylko dla pól systemowych z seeda. Pole
    /// założone z UI nie ma klucza i front pokazuje <see cref="Name"/>, nigdy surowy klucz
    /// (<c>FLD-002</c> AC1).</summary>
    public string? NameKey { get; set; }

    public CustomFieldDataType DataType { get; set; }

    /// <summary>Slot sortowalny albo <see cref="FieldSlot.None"/> dla pola, po którym nikt
    /// nie sortuje ani nie filtruje.</summary>
    public FieldSlot Slot { get; set; }

    public int OrderNo { get; set; }

    public bool IsRequired { get; set; }

    public List<string> Options { get; set; } = [];
}

public sealed class FieldSchemeAddFieldCommandHandler : CommandHandler<FieldSchemeAddFieldCommand, Guid>
{
    private readonly IFieldSchemeRepository _schemes;

    public FieldSchemeAddFieldCommandHandler(IFieldSchemeRepository schemes) => _schemes = schemes;

    public override async Task<Guid> ExecuteAsync(FieldSchemeAddFieldCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(FieldScheme), command.Uuid);

        scheme.AddField(
            command.FieldUuid == Guid.Empty ? Entity.NewUuid() : command.FieldUuid,
            command.Code,
            command.Name,
            command.NameKey,
            command.DataType,
            command.Slot,
            command.OrderNo,
            command.IsRequired,
            command.Options);

        return scheme.Uuid;
    }
}

/// <summary>
/// Usuwa definicję pola ze schematu.
///
/// <para>Odmawia, gdy <b>którekolwiek zgłoszenie ma w tym polu wartość</b>. Bez tej reguły
/// slot wracałby do puli razem z danymi w środku i pierwsze pole, które by go dostało,
/// odziedziczyłoby cudze wartości — sortowanie po „Budżecie" pokazywałoby liczby godzin
/// sprzed roku (§6).</para>
/// </summary>
public sealed class FieldSchemeRemoveFieldCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid FieldUuid { get; set; }
}

public sealed class FieldSchemeRemoveFieldCommandHandler : CommandHandler<FieldSchemeRemoveFieldCommand, Guid>
{
    private readonly IFieldSchemeRepository _schemes;
    private readonly IFieldUsageProbe _usage;

    public FieldSchemeRemoveFieldCommandHandler(IFieldSchemeRepository schemes, IFieldUsageProbe usage)
    {
        _schemes = schemes;
        _usage = usage;
    }

    public override async Task<Guid> ExecuteAsync(FieldSchemeRemoveFieldCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(FieldScheme), command.Uuid);

        var field = scheme.Fields.FirstOrDefault(f => f.Uuid == command.FieldUuid)
            ?? throw new AggregateNotFoundException(nameof(FieldDefinition), command.FieldUuid);

        if (await _usage.IsUsedAsync(scheme.Uuid, field.Code, ct).ConfigureAwait(false))
        {
            throw new DomainException(
                "taskmgmt.field_in_use",
                $"Pole `{field.Code}` ma wartości na zgłoszeniach — usunięcie zwolniłoby slot razem z danymi.");
        }

        scheme.RemoveField(command.FieldUuid);

        return scheme.Uuid;
    }
}
