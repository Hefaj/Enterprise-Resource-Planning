using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Tags;

/// <summary>
/// Tag — byt, nie pole niestandardowe (TAG-001): zgłoszenie ma ich wiele naraz, a filtrowanie
/// po tagu jest joinem na <c>issue_tag</c>, nie przeszukiwaniem jsonb.
///
/// <para><see cref="ProjectUuid"/> <c>null</c> znaczy tag globalny — dostępny na każdym
/// projekcie. Scalanie i zmiana nazwy (<c>TAG-003</c>) to faza 7.</para>
/// </summary>
public sealed class Tag : AggregateRoot
{
    private const string DefaultColor = "#94A3B8";

    /// <summary>Konstruktor dla EF Core.</summary>
    private Tag()
    {
    }

    private Tag(Guid uuid, Guid? projectUuid, string name, string color) : base(uuid)
    {
        ProjectUuid = projectUuid;
        Name = name;
        Color = color;
    }

    public Guid? ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Color { get; private set; } = DefaultColor;

    public static Tag CreateWithUuid(Guid uuid, Guid? projectUuid, string name, string? color)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.tag_name_empty", "Nazwa tagu nie może być pusta.");
        }

        return new Tag(
            uuid,
            projectUuid == Guid.Empty ? null : projectUuid,
            name.Trim(),
            string.IsNullOrWhiteSpace(color) ? DefaultColor : color.Trim());
    }
}
