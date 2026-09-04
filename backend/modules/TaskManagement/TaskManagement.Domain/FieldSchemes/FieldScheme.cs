using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.FieldSchemes;

/// <summary>
/// Schemat pól niestandardowych — zestaw pól, który projekt nakłada na swoje zgłoszenia
/// (<c>docs/modules/task-management/domain.md</c> §6). Dev chce <c>Component</c> i <c>Fix Version</c>,
/// marketing <c>Kanał</c> i <c>Budżet</c>; to ten sam model, co typ dokumentu w DMS, i celowo
/// się od niego nie różni.
///
/// <para><b>Schemat jest daną, nie klasą</b> — tak samo jak automat stanów. Nowy zestaw pól
/// nie wymaga wdrożenia kodu, dopóki mieści się w puli slotów.</para>
/// </summary>
public sealed class FieldScheme : AggregateRoot
{
    private readonly List<FieldDefinition> _fields = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private FieldScheme()
    {
    }

    private FieldScheme(Guid uuid, string name, bool isSystem) : base(uuid)
    {
        Name = name;
        IsSystem = isSystem;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Schemat systemowy — zasilany seedem, nieusuwalny z UI.</summary>
    public bool IsSystem { get; private set; }

    public IReadOnlyList<FieldDefinition> Fields => _fields.AsReadOnly();

    public static FieldScheme CreateWithUuid(Guid uuid, string name, bool isSystem)
        => new(uuid, ValidateName(name), isSystem);

    public void SetName(string name) => Name = ValidateName(name);

    /// <summary>
    /// Dokłada definicję pola.
    /// </summary>
    /// <remarks>
    /// Dwie reguły, obie o slotach. Slot musi <b>pasować typem</b> (<see cref="FieldSlots"/>)
    /// i musi być <b>wolny w obrębie schematu</b> — dwa pola w jednym slocie to dwie różne
    /// wartości w jednej kolumnie, czyli sortowanie po jednym z nich zwracające drugie.
    /// Pole bez slotu (<see cref="FieldSlot.None"/>) jest w porządku: nie da się po nim
    /// sortować ani filtrować i tak jest zadeklarowane w profilu.
    /// </remarks>
    public FieldDefinition AddField(
        Guid uuid,
        string code,
        string name,
        string? nameKey,
        CustomFieldDataType dataType,
        FieldSlot slot,
        int orderNo,
        bool isRequired = false,
        IEnumerable<string>? options = null)
    {
        var normalizedCode = ValidateCode(code);

        if (_fields.Exists(f => string.Equals(f.Code, normalizedCode, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainException(
                "taskmgmt.field_code_duplicate",
                $"Pole `{normalizedCode}` już istnieje w tym schemacie.");
        }

        FieldSlots.EnsureAccepts(slot, dataType);

        if (slot != FieldSlot.None && _fields.Exists(f => f.Slot == slot))
        {
            throw new DomainException(
                "taskmgmt.field_slot_taken",
                $"Slot {slot} jest już zajęty przez inne pole tego schematu.");
        }

        var optionList = (options ?? []).Select(o => o.Trim()).Where(o => o.Length > 0).Distinct().ToList();

        if (dataType == CustomFieldDataType.Select && optionList.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.field_select_without_options",
                $"Pole `{normalizedCode}` typu Select musi mieć listę dopuszczalnych wartości.");
        }

        var field = FieldDefinition.Create(uuid, Uuid, normalizedCode, name, nameKey, dataType, slot, orderNo, isRequired, optionList);
        _fields.Add(field);
        return field;
    }

    /// <summary>
    /// Usuwa definicję pola.
    ///
    /// <para><b>Nie ma metody „zmień slot pola" i to jest cała egzekucja reguły „mapowanie
    /// pole↔slot jest niezmienne po pierwszym użyciu"</b> (§6). Przemapowanie slotu podmieniłoby
    /// znaczenie danych historycznych — kolumna z budżetami zaczęłaby uchodzić za kolumnę
    /// z liczbą godzin. Skasowanie pola, którego zgłoszenia już używają, blokuje handler
    /// komendy jednym zapytaniem o zajętość slotu; agregat nie ma jak tego sprawdzić, bo
    /// zgłoszenia są poza jego granicą.</para>
    /// </summary>
    public void RemoveField(Guid fieldUuid)
    {
        var field = _fields.Find(f => f.Uuid == fieldUuid)
            ?? throw new DomainException(
                "taskmgmt.field_not_found",
                $"Pole {fieldUuid} nie należy do tego schematu.");

        _fields.Remove(field);
    }

    public FieldDefinition? FindByCode(string code)
        => _fields.Find(f => string.Equals(f.Code, code, StringComparison.OrdinalIgnoreCase));

    private static string ValidateCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("taskmgmt.field_code_empty", "Kod pola nie może być pusty.");
        }

        var trimmed = code.Trim();

        if (trimmed.Length > 64)
        {
            throw new DomainException("taskmgmt.field_code_invalid", "Kod pola może mieć najwyżej 64 znaki.");
        }

        // Kod jedzie do frontu jako klucz kolumny i klucz filtra, a do bazy jako klucz w jsonb.
        // Znaki spoza tego zbioru wymagałyby cudzysłowów w jednym z tych trzech miejsc.
        foreach (var c in trimmed)
        {
            if (!char.IsAsciiLetterOrDigit(c) && c != '_')
            {
                throw new DomainException(
                    "taskmgmt.field_code_invalid",
                    "Kod pola może zawierać wyłącznie litery ASCII, cyfry i podkreślenie.");
            }
        }

        return trimmed;
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.field_scheme_name_empty", "Nazwa schematu pól nie może być pusta.");
        }

        return name.Trim();
    }
}

/// <summary>
/// Definicja jednego pola niestandardowego: kod, klucz tłumaczenia, typ, slot i kolejność.
///
/// <para>Wszystko, co tu jest, jedzie do frontu przez <c>getProjectFieldProfile</c> — kolumny
/// tabeli, filtry i whitelist sortowania budują się z tej samej odpowiedzi, więc oba końce
/// nie mają jak się rozjechać (§6).</para>
/// </summary>
public sealed class FieldDefinition : Entity
{
    private readonly List<string> _options = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private FieldDefinition()
    {
    }

    private FieldDefinition(
        Guid uuid,
        Guid schemeUuid,
        string code,
        string name,
        string? nameKey,
        CustomFieldDataType dataType,
        FieldSlot slot,
        int orderNo,
        bool isRequired,
        IEnumerable<string> options)
        : base(uuid)
    {
        SchemeUuid = schemeUuid;
        Code = code;
        Name = name;
        NameKey = nameKey;
        DataType = dataType;
        Slot = slot;
        OrderNo = orderNo;
        IsRequired = isRequired;
        _options.AddRange(options);
    }

    public Guid SchemeUuid { get; private set; }

    /// <summary>Kod pola — klucz w <c>issue.custom_fields</c>, klucz kolumny na froncie
    /// i nazwa pola w sortowaniu.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Nazwa wpisana wprost przez użytkownika zakładającego pole z UI (<c>FLD-002</c>)
    /// — front przestaje pokazywać surowy <see cref="NameKey"/>, gdy go zabraknie.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Klucz tłumaczenia nagłówka — tylko dla pól systemowych z seeda. Opcjonalny:
    /// pole założone z UI ma tylko <see cref="Name"/>, tak samo jak nazwa stanu w schemacie
    /// przejść ma klucz tylko, gdy pochodzi z seeda.</summary>
    public string? NameKey { get; private set; }

    public CustomFieldDataType DataType { get; private set; }

    /// <summary>Slot sortowalny albo <see cref="FieldSlot.None"/>. To jedno pole rozstrzyga
    /// jednocześnie o sortowalności i filtrowalności — pole bez slotu nie da się posortować
    /// bez pełnego skanu jsonb, a pole ze slotem da się zawsze.</summary>
    public FieldSlot Slot { get; private set; }

    public int OrderNo { get; private set; }

    public bool IsRequired { get; private set; }

    /// <summary>Dopuszczalne wartości pola typu <see cref="CustomFieldDataType.Select"/>.</summary>
    public IReadOnlyList<string> Options => _options.AsReadOnly();

    /// <summary>Czy po tym polu da się sortować i filtrować — czyli czy zajmuje slot.</summary>
    public bool IsSortable => Slot != FieldSlot.None;

    internal static FieldDefinition Create(
        Guid uuid,
        Guid schemeUuid,
        string code,
        string name,
        string? nameKey,
        CustomFieldDataType dataType,
        FieldSlot slot,
        int orderNo,
        bool isRequired,
        IEnumerable<string> options)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.field_name_empty", "Nazwa pola nie może być pusta.");
        }

        return new(uuid, schemeUuid, code, name.Trim(), nameKey, dataType, slot, orderNo, isRequired, options);
    }
}
