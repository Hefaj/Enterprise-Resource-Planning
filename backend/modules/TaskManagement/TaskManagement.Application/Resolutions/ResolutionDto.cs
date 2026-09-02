namespace TaskManagement.Application.Resolutions;

/// <summary>Rozwiązanie w widoku odczytu (ISS-007).</summary>
public sealed record ResolutionDto(Guid Uuid, Guid? ProjectUuid, string Name, string? NameKey, bool IsSystem, int OrderNo);

/// <summary>Żądanie listy rozwiązań widocznych na projekcie — systemowe plus własne projektu.
/// Pusty <see cref="ProjectUuid"/> zwraca tylko rozwiązania systemowe.</summary>
public sealed class SearchResolutionRequest
{
    public Guid? ProjectUuid { get; set; }
}

/// <summary>Odczyty rozwiązań.</summary>
public interface IResolutionQueries
{
    Task<List<ResolutionDto>> SearchAsync(SearchResolutionRequest request, CancellationToken cancellationToken);
}
