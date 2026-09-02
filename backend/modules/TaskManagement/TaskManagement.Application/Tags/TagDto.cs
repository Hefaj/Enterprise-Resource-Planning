namespace TaskManagement.Application.Tags;

/// <summary>Tag w widoku odczytu.</summary>
public sealed record TagDto(Guid Uuid, Guid? ProjectUuid, string Name, string Color);

/// <summary>Żądanie listy tagów widocznych na projekcie — globalne plus własne projektu.
/// Pusty <see cref="ProjectUuid"/> zwraca tylko tagi globalne.</summary>
public sealed class SearchTagRequest
{
    public Guid? ProjectUuid { get; set; }
}

/// <summary>Odczyty tagów.</summary>
public interface ITagQueries
{
    Task<List<TagDto>> SearchAsync(SearchTagRequest request, CancellationToken cancellationToken);
}
