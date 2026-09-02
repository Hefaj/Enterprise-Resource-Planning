using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Przypisanie tagu do zgłoszenia — encja podrzędna <see cref="Issue"/>, wzorem
/// <see cref="IssueWatcher"/>. W odróżnieniu od obserwatora nie niesie stanu poza samym
/// wskazaniem tagu — usunięcie usuwa wiersz (brak odpowiednika „rezygnacji").
/// </summary>
public sealed class IssueTag : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueTag()
    {
    }

    private IssueTag(Guid uuid, Guid tagUuid) : base(uuid)
    {
        TagUuid = tagUuid;
    }

    public Guid IssueUuid { get; private set; }

    public Guid TagUuid { get; private set; }

    internal static IssueTag Create(Guid uuid, Guid tagUuid)
    {
        if (tagUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.issue_tag_empty", "Przypisanie tagu musi wskazywać tag.");
        }

        return new IssueTag(uuid, tagUuid);
    }
}
