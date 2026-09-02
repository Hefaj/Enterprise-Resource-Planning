using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Resolutions;

/// <summary>
/// Rozwiązanie zgłoszenia (ISS-007) — słownik, nie wolny tekst: `Zrobione`/`Duplikat`/
/// `Nie zrobimy`/`Nie da się odtworzyć` z seeda systemowego, ewentualnie rozszerzony o pozycje
/// własne projektu.
///
/// <para><see cref="ProjectUuid"/> <c>null</c> znaczy rozwiązanie systemowe — widoczne na każdym
/// projekcie, tak samo jak tag globalny (<see cref="Tags.Tag"/>). <see cref="IsSystem"/> chroni
/// seed przed usunięciem/zmianą kategorii z UI, wzorem <c>IssueTypeScheme.IsSystem</c>.</para>
/// </summary>
public sealed class Resolution : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private Resolution()
    {
    }

    private Resolution(Guid uuid, Guid? projectUuid, string name, string? nameKey, bool isSystem, int orderNo)
        : base(uuid)
    {
        ProjectUuid = projectUuid;
        Name = name;
        NameKey = nameKey;
        IsSystem = isSystem;
        OrderNo = orderNo;
    }

    public Guid? ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Klucz tłumaczenia dla pozycji systemowych — front pokazuje tłumaczenie zamiast
    /// <see cref="Name"/>, gdy jest ustawiony (ten sam wzorzec, co <c>IssueType.NameKey</c>).</summary>
    public string? NameKey { get; private set; }

    public bool IsSystem { get; private set; }

    public int OrderNo { get; private set; }

    public static Resolution CreateWithUuid(
        Guid uuid,
        Guid? projectUuid,
        string name,
        string? nameKey,
        bool isSystem,
        int orderNo)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.resolution_name_empty", "Nazwa rozwiązania nie może być pusta.");
        }

        return new Resolution(
            uuid,
            projectUuid == Guid.Empty ? null : projectUuid,
            name.Trim(),
            string.IsNullOrWhiteSpace(nameKey) ? null : nameKey.Trim(),
            isSystem,
            orderNo);
    }
}
