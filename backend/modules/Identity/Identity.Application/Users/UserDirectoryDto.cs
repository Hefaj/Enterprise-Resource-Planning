using Erp.BuildingBlocks.Api.Contracts;

namespace Identity.Application.Users;

/// <summary>
/// Użytkownik w widoku katalogowym — <b>książka telefoniczna firmy</b>, nie karta konta.
///
/// <para>Świadomie osobny DTO od <see cref="UserAccountDto"/>, mimo że opisuje ten sam agregat.
/// Tamten wozi nadania ról i uprawnień, bo zasila ekran administracyjny; ten trafia do pickera
/// przypisania w Task Management, do autora komentarza i (od swojej fazy) do DMS-u. Gdyby oba
/// ekrany dzieliły jeden DTO, wybranie osoby do zadania oznaczałoby wysłanie przeglądarce
/// kompletu jej uprawnień — i odwrotnie: każde nowe pole administracyjne rosłoby w każdej
/// podpowiedzi wyszukiwarki.</para>
/// </summary>
public sealed record UserDirectoryDto(Guid Uuid, string DisplayName, string Email, bool IsActive);

/// <summary>
/// Wyszukiwanie w katalogu.
///
/// <para>Jeden parametr tekstowy zamiast osobnych pól na imię i e-mail: użytkownik pickera pisze
/// „kowal” i nie zastanawia się, w które pole trafia — a katalog ma dokładnie dwa pola, po
/// których da się szukać.</para>
/// </summary>
public sealed class SearchUserDirectoryRequest : PagedRequest
{
    /// <summary>Fragment nazwy wyświetlanej albo adresu e-mail; wielkość liter bez znaczenia.</summary>
    public string? Query { get; set; }

    /// <summary>
    /// Czy pokazywać konta nieaktywne. Domyślnie <c>false</c>, bo picker służy do wskazania
    /// osoby, która ma coś zrobić — a osoba wyłączona z systemu tego nie zrobi.
    ///
    /// <para>Nieaktywnych nie da się jednak ukryć całkiem: nadal wracają z
    /// <c>getUserDirectory</c> po uuid, bo historyczne przypisanie musi się wyświetlić nazwiskiem
    /// także wtedy, gdy autor zmiany dawno odszedł z firmy.</para>
    /// </summary>
    public bool IncludeInactive { get; set; }
}

/// <summary>Pobranie pozycji katalogu po identyfikatorach — druga połowa kontraktu pickera
/// (`searchFn` oddaje uuidy, `getFn` zamienia je na nazwy).</summary>
public sealed class GetUserDirectoryRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty katalogu użytkowników. Implementacja w <c>Identity.Infrastructure</c>.</summary>
public interface IUserDirectoryQueries
{
    Task<SearchResponse> SearchAsync(SearchUserDirectoryRequest request, CancellationToken cancellationToken);

    /// <summary>Pozycje katalogu po uuid — <b>także nieaktywne</b>, patrz
    /// <see cref="SearchUserDirectoryRequest.IncludeInactive"/>.</summary>
    Task<List<UserDirectoryDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
