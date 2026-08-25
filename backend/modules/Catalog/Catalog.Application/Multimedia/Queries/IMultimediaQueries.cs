using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Multimedia;

// Strona odczytu CQRS. Interfejsy żyją tu, implementacje w Catalog.Infrastructure —
// dzięki temu warstwa Application nie zna EF Core (pilnuje tego Erp.ArchitectureTests),
// a endpointy w Catalog.Api zależą od abstrakcji, nie od dostawcy bazy.
//
// Zapytania świadomie OMIJAJĄ repozytoria i agregaty domenowe: rzutują wprost z tabel na DTO
// (`AsNoTracking` + projekcja). To jest cel rozdziału na komendy i zapytania, a nie skrót —
// materializowanie pełnych agregatów tylko po to, żeby zaraz spłaszczyć je do DTO, kosztuje
// przy listach po kilkaset pozycji i nie daje nic w zamian.

/// <summary>Odczyty multimediów.</summary>
public interface IMultimediaQueries
{
    Task<SearchResponse> SearchAsync(SearchMultimediaRequest request, CancellationToken cancellationToken);

    Task<List<MultimediaDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>
    /// Które z podanych identyfikatorów wskazują istniejący zasób.
    ///
    /// <para>Jedno zapytanie na cały wsad — używa tego reguła sprawdzająca, czy dopinane pliki
    /// w ogóle są w katalogu. Pytanie per plik przy operacji na tysiącach produktów kosztowałoby
    /// tyle zapytań, ile wynosi iloczyn obu list.</para>
    /// </summary>
    Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);

    /// <summary>Identyfikatory pasujące do filtra — cele operacji masowej wskazanej filtrem.</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchMultimediaRequest filter, CancellationToken cancellationToken);

    /// <summary>
    /// Ile agregatów wskazuje na każdy z podanych zasobów. Brak klucza w wyniku = zero referencji.
    ///
    /// <para>Jedno zapytanie na cały wsad, bo woła to komenda usuwająca w trybie masowym —
    /// pytanie per zasób dałoby tyle zapytań, ile elementów chunka.</para>
    /// </summary>
    Task<Dictionary<Guid, int>> CountReferencesAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken);

    /// <summary>
    /// Ile agregatów wskazuje na każdy z zasobów, <b>z pominięciem jednego produktu</b>.
    ///
    /// <para>Po co pominięcie: kaskada pyta o to w środku transakcji, w której odpięte przed
    /// chwilą wiersze <c>product_multimedia</c> jeszcze w bazie są. Zwykły licznik pokazałby
    /// stan sprzed odpięcia i kaskada nigdy by nie zadziałała. Wykluczenie produktu daje
    /// dokładnie stan po zapisie — bez zaglądania w ChangeTracker z warstwy, która o EF nie wie
    /// (<c>docs/backend/media-storage.md</c> §4c).</para>
    /// </summary>
    Task<Dictionary<Guid, int>> CountReferencesExceptAsync(
        IReadOnlyCollection<Guid> uuids,
        Guid excludedProductUuid,
        CancellationToken cancellationToken);

    /// <summary>
    /// Które z podanych artefaktów magazynu są opisane wpisem w katalogu.
    ///
    /// <para>Pyta audytor rozjazdu, idąc od magazynu do bazy — dlatego adresuje po
    /// <c>artifact_uuid</c>, a nie po uuid zasobu, i dlatego pod tę kolumnę jest indeks.
    /// Artefakt, którego tu nie ma, jest kandydatem na sierotę
    /// (<c>docs/backend/media-storage.md</c> §4d).</para>
    /// </summary>
    Task<HashSet<Guid>> GetKnownArtifactUuidsAsync(
        IReadOnlyCollection<Guid> artifactUuids,
        CancellationToken cancellationToken);

    /// <summary>
    /// Wszystko, czego endpoint zawartości potrzebuje, żeby wydać plik; <c>null</c>, gdy zasób
    /// nie istnieje albo jest wskazany adresem zewnętrznym (patrz
    /// <c>MultimediaAsset.OriginalUrl</c>) — wtedy bajty leżą poza systemem.
    ///
    /// <para>Osobne, wąskie zapytanie zamiast pełnego DTO, bo woła je endpoint serwujący
    /// zawartość — przy każdej miniaturce w galerii.</para>
    /// </summary>
    Task<MultimediaContentRef?> GetContentRefAsync(Guid uuid, CancellationToken cancellationToken);
}

/// <summary>
/// Namiary na zawartość zasobu, czytane z katalogu — bez odpytywania magazynu.
///
/// <para><b>Nazwa, typ i rozmiar pochodzą z bazy, a nie ze <c>StatObject</c>.</b> Wolno tak,
/// bo zawartość pod danym uuid nigdy się nie zmienia: podmiana pliku jest nowym zasobem, nie
/// edycją istniejącego. Odpytywanie magazynu o metadane przy każdej miniaturce dokładałoby
/// round-trip po to, żeby usłyszeć to, co katalog już wie — a rozmiar i typ i tak trafiły do
/// bazy prosto z magazynu, w chwili rejestracji pliku.</para>
/// </summary>
/// <param name="ArtifactUuid">Obiekt w magazynie. Nie wychodzi poza backend.</param>
/// <param name="FileName">Nazwa pliku z dysku użytkownika — do <c>Content-Disposition</c>.</param>
/// <param name="MimeType">Typ MIME odczytany z magazynu przy rejestracji.</param>
/// <param name="FileSize">Rozmiar w bajtach — do <c>Content-Length</c>.</param>
public sealed record MultimediaContentRef(Guid ArtifactUuid, string FileName, string MimeType, long FileSize);
