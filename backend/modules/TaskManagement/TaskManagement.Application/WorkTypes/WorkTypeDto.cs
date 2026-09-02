namespace TaskManagement.Application.WorkTypes;

/// <summary>Rodzaj pracy w widoku odczytu.</summary>
public sealed record WorkTypeDto(Guid Uuid, Guid? ProjectUuid, string Name);

/// <summary>Żądanie listy rodzajów pracy widocznych na projekcie — globalne plus własne
/// projektu, wzorem <c>SearchTagRequest</c>.</summary>
public sealed class SearchWorkTypeRequest
{
    public Guid? ProjectUuid { get; set; }
}

/// <summary>Odczyty rodzajów pracy (TIME-001 AC2).</summary>
public interface IWorkTypeQueries
{
    Task<List<WorkTypeDto>> SearchAsync(SearchWorkTypeRequest request, CancellationToken cancellationToken);
}
