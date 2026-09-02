using TaskManagement.Domain.Sprints;

namespace TaskManagement.Application.Sprints;

/// <summary>Sprint w widoku odczytu.</summary>
public sealed record SprintDto(
    Guid Uuid,
    Guid BoardUuid,
    string Name,
    string? Goal,
    DateOnly? StartsOn,
    DateOnly? EndsOn,
    SprintStatus Status,
    DateTimeOffset? ActivatedAt,
    DateTimeOffset? ClosedAt);

/// <summary>Żądanie listy sprintów. Pusty <see cref="BoardUuid"/> zwraca wszystkie widoczne.</summary>
public sealed class SearchSprintRequest
{
    public Guid? BoardUuid { get; set; }

    public SprintStatus? Status { get; set; }
}

/// <summary>Żądanie pojedynczego sprintu.</summary>
public sealed class GetSprintRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>Odczyty sprintów. Widoczność dziedziczy po projekcie tablicy — jak <see cref="Boards.IBoardQueries"/>.</summary>
public interface ISprintQueries
{
    Task<List<SprintDto>> SearchAsync(SearchSprintRequest request, CancellationToken cancellationToken);

    Task<SprintDto?> GetAsync(Guid uuid, CancellationToken cancellationToken);
}
