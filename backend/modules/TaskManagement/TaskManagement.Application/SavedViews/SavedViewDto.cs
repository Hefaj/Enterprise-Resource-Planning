using TaskManagement.Domain.SavedViews;

namespace TaskManagement.Application.SavedViews;

/// <summary>Widok zapisany w odczycie (VIEW-001). <see cref="IsOwn"/> pozwala frontowi
/// odróżnić własny widok (edytowalny) od cudzego udostępnionego projektowi
/// (tylko do odczytu, VIEW-001 AC1) bez osobnego zapytania o tożsamość.</summary>
public sealed record SavedViewDto(
    Guid Uuid,
    Guid OwnerUserUuid,
    Guid? ProjectUuid,
    string Name,
    string FilterJson,
    string? SortJson,
    IReadOnlyList<string> Columns,
    SavedViewMode Mode,
    bool IsOwn);

/// <summary>Żądanie listy widoków — własne widoki właściciela, a gdy podano projekt, doklejone
/// widoki udostępnione temu projektowi przez kogokolwiek (VIEW-001 „SearchSavedView zwraca
/// własne + udostępnione projektowi").</summary>
public sealed class SearchSavedViewRequest
{
    public Guid? ProjectUuid { get; set; }
}

/// <summary>Odczyty zapisanych widoków.</summary>
public interface ISavedViewQueries
{
    Task<List<SavedViewDto>> SearchAsync(SearchSavedViewRequest request, CancellationToken cancellationToken);
}
