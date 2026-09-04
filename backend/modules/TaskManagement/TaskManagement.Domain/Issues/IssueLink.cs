using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Powiązanie między dwoma zgłoszeniami — krawędź grafu
/// (<c>docs/modules/task-management/domain.md</c> §8.1).
///
/// <para><b>Osobny korzeń agregatu, nie kolekcja na zgłoszeniu.</b> Krawędź należy do dwóch
/// zgłoszeń naraz, więc nie ma jednego właściciela, który mógłby ją trzymać: umieszczenie jej
/// przy źródle sprawiłoby, że karta celu musi przeszukiwać cudze kolekcje, żeby narysować swój
/// pasek powiązań. Realtime też na tym korzysta — dopięcie blokady odświeża obie karty,
/// bo obie mają w cache tę samą krawędź.</para>
///
/// <para>Kierunek jest częścią znaczenia: <c>A blokuje B</c> to nie to samo, co
/// <c>B blokuje A</c>. Front pokazuje ten sam wiersz z dwóch stron pod dwiema etykietami
/// („blokuje" / „blokowane przez"), ale w bazie jest to jedna krawędź.</para>
/// </summary>
public sealed class IssueLink : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueLink()
    {
    }

    private IssueLink(
        Guid uuid,
        Guid sourceUuid,
        Guid targetUuid,
        IssueLinkType type,
        Guid createdBy,
        DateTimeOffset createdAt)
        : base(uuid)
    {
        SourceUuid = sourceUuid;
        TargetUuid = targetUuid;
        Type = type;
        CreatedBy = createdBy;
        CreatedAt = createdAt;
    }

    public Guid SourceUuid { get; private set; }

    public Guid TargetUuid { get; private set; }

    public IssueLinkType Type { get; private set; }

    public Guid CreatedBy { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static IssueLink CreateWithUuid(
        Guid uuid,
        Guid sourceUuid,
        Guid targetUuid,
        IssueLinkType type,
        Guid createdBy,
        DateTimeOffset createdAt)
    {
        if (sourceUuid == Guid.Empty || targetUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.link_endpoint_empty",
                "Powiązanie musi wskazywać dwa zgłoszenia.");
        }

        // Samo-powiązanie łapiemy tutaj, a nie w regule wsadowej: to nie jest cykl w grafie,
        // tylko wiersz, który nigdy nie ma sensu — niezależnie od typu i od reszty wsadu.
        if (sourceUuid == targetUuid)
        {
            throw new DomainException(
                "taskmgmt.link_self",
                "Zgłoszenie nie może być powiązane samo ze sobą.");
        }

        return new IssueLink(uuid, sourceUuid, targetUuid, type, createdBy, createdAt);
    }
}
