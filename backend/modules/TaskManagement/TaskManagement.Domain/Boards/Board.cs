using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Boards;

/// <summary>
/// Tablica: kolumny mapowane na stany schematu i kolejność kart w tabeli podrzędnej
/// (<c>docs/backend/task-management.md</c> §3, §7).
///
/// <para><b>Kolumna, w której leży karta, nie jest przechowywana</b> — wynika ze stanu
/// zgłoszenia i z mapowania kolumn. Zduplikowanie jej na karcie dałoby dwa źródła prawdy,
/// rozjeżdżające się przy każdej zmianie stanu spoza tablicy (§7.1).</para>
///
/// <para>Faza 2 wiąże tablicę z jednym projektem. Filtr „projekt/y + warunek” z §3 wchodzi
/// razem z językiem warunków — pusta kolumna filtru dziś nie różniłaby się niczym od jej
/// braku, a migracja tabeli o dwa wiersze kosztuje mniej niż kolumna trzymana na zapas.</para>
/// </summary>
public sealed class Board : AggregateRoot
{
    private readonly List<BoardColumn> _columns = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private Board()
    {
    }

    private Board(Guid uuid, Guid projectUuid, string name, BoardMode mode, bool isDefault)
        : base(uuid)
    {
        ProjectUuid = projectUuid;
        Name = name;
        Mode = mode;
        IsDefault = isDefault;
    }

    public Guid ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public BoardMode Mode { get; private set; }

    /// <summary>Tablica otwierana z menu projektu, gdy nikt nie wskazał innej.</summary>
    public bool IsDefault { get; private set; }

    /// <summary>Oś grupowania wierszy (BRD-006) — <see cref="BoardSwimlaneMode.None"/> domyślnie,
    /// zgodnie ze stanem sprzed fazy 6.</summary>
    public BoardSwimlaneMode SwimlaneMode { get; private set; } = BoardSwimlaneMode.None;

    /// <summary>Kod pola niestandardowego — ustawiony wyłącznie razem z
    /// <see cref="BoardSwimlaneMode.CustomField"/>, w każdym innym trybie <c>null</c>.</summary>
    public string? SwimlaneFieldCode { get; private set; }

    public IReadOnlyList<BoardColumn> Columns => _columns.AsReadOnly();

    public static Board CreateWithUuid(
        Guid uuid,
        Guid projectUuid,
        string name,
        BoardMode mode,
        bool isDefault)
    {
        if (projectUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.board_project_empty", "Tablica musi należeć do projektu.");
        }

        return new Board(uuid, projectUuid, ValidateName(name), mode, isDefault);
    }

    public void SetName(string name) => Name = ValidateName(name);

    /// <summary>
    /// Dokłada kolumnę mapowaną na stany schematu.
    /// </summary>
    /// <remarks>
    /// Stan przypisany do dwóch kolumn jest odrzucany: karta jest w dokładnie jednym stanie,
    /// więc taka konfiguracja kazałaby narysować ją w dwóch miejscach naraz. Stan
    /// <b>nieprzypisany do żadnej</b> kolumny jest dozwolony i oznacza „zgłoszenie znika
    /// z tablicy” — tak działa kolumna „gotowe” schowana za filtrem.
    /// </remarks>
    public BoardColumn AddColumn(Guid uuid, string name, int orderNo, IEnumerable<Guid> stateUuids, int? wipLimit = null)
    {
        ArgumentNullException.ThrowIfNull(stateUuids);

        var states = stateUuids.Distinct().ToList();

        if (states.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.board_column_without_state",
                $"Kolumna `{name}` nie jest zmapowana na żaden stan — nie da się ustalić, co ma w niej leżeć.");
        }

        var taken = states.Find(s => _columns.Exists(c => c.Handles(s)));
        if (taken != Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.board_column_state_taken",
                $"Stan {taken} jest już zmapowany na inną kolumnę tej tablicy.");
        }

        if (wipLimit is < 1)
        {
            throw new DomainException(
                "taskmgmt.board_column_wip_limit_invalid",
                "Limit WIP musi być dodatni.");
        }

        var column = BoardColumn.Create(uuid, Uuid, ValidateName(name), orderNo, states, wipLimit);
        _columns.Add(column);
        return column;
    }

    /// <summary>Ustawia oś grupowania wierszy (BRD-006). Kod pola wolno podać wyłącznie razem
    /// z <see cref="BoardSwimlaneMode.CustomField"/> — w każdym innym trybie źródło grupowania
    /// wynika z samego trybu, drugie pole byłoby drugim źródłem prawdy.</summary>
    public void SetSwimlane(BoardSwimlaneMode mode, string? fieldCode)
    {
        if (mode == BoardSwimlaneMode.CustomField && string.IsNullOrWhiteSpace(fieldCode))
        {
            throw new DomainException(
                "taskmgmt.board_swimlane_field_code_required",
                "Grupowanie po polu niestandardowym wymaga wskazania kodu pola.");
        }

        if (mode != BoardSwimlaneMode.CustomField && fieldCode is not null)
        {
            throw new DomainException(
                "taskmgmt.board_swimlane_field_code_unexpected",
                "Kod pola ma sens wyłącznie przy grupowaniu po polu niestandardowym.");
        }

        SwimlaneMode = mode;
        SwimlaneFieldCode = mode == BoardSwimlaneMode.CustomField ? fieldCode!.Trim() : null;
    }

    public void RemoveColumn(Guid columnUuid)
    {
        var column = _columns.Find(c => c.Uuid == columnUuid)
            ?? throw new DomainException(
                "taskmgmt.board_column_not_found",
                $"Kolumna {columnUuid} nie należy do tej tablicy.");

        _columns.Remove(column);
    }

    /// <summary>Kolumna, w której wyląduje zgłoszenie w danym stanie — albo <c>null</c>,
    /// gdy stan nie jest na tej tablicy pokazywany.</summary>
    public BoardColumn? ColumnForState(Guid stateUuid) => _columns.Find(c => c.Handles(stateUuid));

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.board_name_empty", "Nazwa nie może być pusta.");
        }

        var trimmed = name.Trim();

        if (trimmed.Length > 256)
        {
            throw new DomainException("taskmgmt.board_name_too_long", "Nazwa może mieć najwyżej 256 znaków.");
        }

        return trimmed;
    }
}

/// <summary>
/// Kolumna tablicy — nazwa, kolejność i zbiór stanów, które w niej lądują.
///
/// <para>Stany trzymane są tablicą <c>uuid[]</c>, a nie tabelą podrzędną: nie mają własnych
/// atrybutów, nikt po nich nie sortuje, a jedyne pytanie brzmi „czy zawiera ten stan”.
/// Tabela podrzędna dokładałaby przy tym trzeci poziom zagnieżdżenia, którego skaner zmian
/// świadomie nie obsługuje (<c>AggregateChangeScanner</c>).</para>
/// </summary>
public sealed class BoardColumn : Entity
{
    private readonly List<Guid> _stateUuids = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private BoardColumn()
    {
    }

    private BoardColumn(Guid uuid, Guid boardUuid, string name, int orderNo, IEnumerable<Guid> stateUuids, int? wipLimit)
        : base(uuid)
    {
        BoardUuid = boardUuid;
        Name = name;
        OrderNo = orderNo;
        WipLimit = wipLimit;
        _stateUuids.AddRange(stateUuids);
    }

    public Guid BoardUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public int OrderNo { get; private set; }

    /// <summary>Limit WIP (BRD-007) — sygnał wyłącznie wizualny, przekroczenie NIE blokuje
    /// upuszczenia karty. <c>null</c> znaczy „bez limitu", stan normalny, nie brak konfiguracji.</summary>
    public int? WipLimit { get; private set; }

    public IReadOnlyList<Guid> StateUuids => _stateUuids.AsReadOnly();

    internal static BoardColumn Create(
        Guid uuid, Guid boardUuid, string name, int orderNo, IEnumerable<Guid> stateUuids, int? wipLimit = null)
        => new(uuid, boardUuid, name, orderNo, stateUuids, wipLimit);

    public bool Handles(Guid stateUuid) => _stateUuids.Contains(stateUuid);
}
