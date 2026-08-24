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

    /// <summary>
    /// Artefakt, pod którym leży zawartość zasobu; <c>null</c>, gdy zasób nie istnieje albo
    /// jest wskazany adresem zewnętrznym (patrz <c>MultimediaAsset.OriginalUrl</c>).
    ///
    /// <para>Osobne, wąskie zapytanie zamiast pełnego DTO, bo woła je endpoint serwujący
    /// zawartość — przy każdej miniaturce w galerii.</para>
    /// </summary>
    Task<Guid?> GetArtifactUuidAsync(Guid uuid, CancellationToken cancellationToken);
}
