using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.FieldSchemes;

/// <summary>
/// Slot sortowalny na <c>issue</c> — stała pula kolumn, w której dublują się pola
/// <b>sortowalne i filtrowalne</b> (<c>docs/modules/task-management/domain.md</c> §6).
///
/// <para>Uzasadnienie wyboru slotów — i odrzucenia indeksów wyrażeniowych na jsonb, tabel
/// projekcji per typ oraz EAV — jest wspólne z DMS i nie powtarzamy go tutaj:
/// <c>docs/modules/dms/domain-workflow.md</c> §3.2.</para>
///
/// <para><see cref="None"/> jest wartością pełnoprawną, nie brakiem decyzji: pole, po którym
/// nikt nie sortuje ani nie filtruje, <b>nie zajmuje slotu</b> i żyje wyłącznie w
/// <c>issue.custom_fields</c>. Slotów jest czternaście na schemat i to one są zasobem
/// rzadkim.</para>
/// </summary>
public enum FieldSlot
{
    None = 0,

    Num1 = 1,
    Num2 = 2,
    Num3 = 3,
    Num4 = 4,

    Text1 = 11,
    Text2 = 12,
    Text3 = 13,
    Text4 = 14,

    Date1 = 21,
    Date2 = 22,
    Date3 = 23,
    Date4 = 24,

    User1 = 31,
    User2 = 32,
}

/// <summary>Reguły dopasowania slotu do typu danych.</summary>
public static class FieldSlots
{
    /// <summary>Wszystkie sloty poza <see cref="FieldSlot.None"/>.</summary>
    public static IReadOnlyList<FieldSlot> All { get; } =
    [
        FieldSlot.Num1, FieldSlot.Num2, FieldSlot.Num3, FieldSlot.Num4,
        FieldSlot.Text1, FieldSlot.Text2, FieldSlot.Text3, FieldSlot.Text4,
        FieldSlot.Date1, FieldSlot.Date2, FieldSlot.Date3, FieldSlot.Date4,
        FieldSlot.User1, FieldSlot.User2,
    ];

    /// <summary>Typ danych, który wolno włożyć do tego slotu. <see cref="CustomFieldDataType.Select"/>
    /// dzieli pulę z <see cref="CustomFieldDataType.Text"/> — z punktu widzenia kolumny to ten
    /// sam tekst.</summary>
    public static bool Accepts(FieldSlot slot, CustomFieldDataType dataType) => slot switch
    {
        FieldSlot.Num1 or FieldSlot.Num2 or FieldSlot.Num3 or FieldSlot.Num4
            => dataType == CustomFieldDataType.Number,
        FieldSlot.Text1 or FieldSlot.Text2 or FieldSlot.Text3 or FieldSlot.Text4
            => dataType is CustomFieldDataType.Text or CustomFieldDataType.Select,
        FieldSlot.Date1 or FieldSlot.Date2 or FieldSlot.Date3 or FieldSlot.Date4
            => dataType == CustomFieldDataType.Date,
        FieldSlot.User1 or FieldSlot.User2
            => dataType == CustomFieldDataType.User,
        _ => false,
    };

    /// <summary>Rzuca, gdy slot nie pasuje do typu — wołane przy definiowaniu pola, nie przy
    /// zapisie zgłoszenia: pomyłka tutaj psuje wszystkie przyszłe zapisy naraz.</summary>
    public static void EnsureAccepts(FieldSlot slot, CustomFieldDataType dataType)
    {
        if (slot != FieldSlot.None && !Accepts(slot, dataType))
        {
            throw new DomainException(
                "taskmgmt.field_slot_type_mismatch",
                $"Slot {slot} nie przyjmuje wartości typu {dataType}.");
        }
    }
}
