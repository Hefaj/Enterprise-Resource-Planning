namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Opis artefaktu, jaki producent chce zapisać. Nazwa pliku i moment wygaśnięcia nie wynikają
/// z samych bajtów, więc muszą przyjechać razem z nimi.
/// </summary>
/// <param name="FileName">Nazwa, pod jaką plik ma się pobrać (nie ścieżka w magazynie).</param>
/// <param name="ContentType">Typ MIME — trafia do nagłówka odpowiedzi przy pobieraniu.</param>
/// <param name="ExpireOn">
/// Kiedy artefakt przestaje być dostępny. Musi być spójne z <c>job.expire_on</c> przebiegu, który
/// go wyprodukował — rozjazd w którąkolwiek stronę widzi użytkownik: albo przycisk „Pobierz"
/// prowadzi do 404, albo plik zostaje w magazynie na zawsze i nikt o nim nie wie.
/// </param>
public sealed record ArtifactDescriptor(string FileName, string ContentType, DateTimeOffset? ExpireOn);

/// <summary>Metadane artefaktu odczytane z magazynu.</summary>
/// <param name="Uuid">Identyfikator, po którym artefakt jest adresowany.</param>
/// <param name="FileName">Nazwa pliku podana przy zapisie.</param>
/// <param name="ContentType">Typ MIME podany przy zapisie.</param>
/// <param name="SizeBytes">Rozmiar zapisanego obiektu.</param>
/// <param name="ExpireOn">Moment wygaśnięcia, jeśli został podany.</param>
public sealed record ArtifactMetadata(
    Guid Uuid,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset? ExpireOn);

/// <summary>
/// Klucze, po których konsument wybiera magazyn.
///
/// <para>Rejestracja bez klucza to magazyn artefaktów wygasających — domyślny, bo taki jest
/// każdy plik produkowany przez system. Zawartość trwała musi o siebie poprosić jawnie,
/// przez <see cref="Media"/>; odwrotny domyślny doprowadziłby do cichego wydłużenia życia
/// eksportów, zamiast do głośnego błędu kompilacji.</para>
/// </summary>
public static class ArtifactStoreKeys
{
    /// <summary>Magazyn zawartości trwałej — plików wgranych przez użytkownika.</summary>
    public const string Media = "media";
}

/// <summary>
/// Zgoda na jednorazowy zapis pliku prosto do magazynu, z pominięciem serwisu.
/// </summary>
/// <param name="Uuid">Identyfikator, pod którym artefakt powstanie — nadany z góry, bo klient
/// musi go odesłać w komendzie opisującej plik, zanim serwis zobaczy jakiekolwiek bajty.</param>
/// <param name="Url">Adres, pod który idzie <c>PUT</c> z zawartością.</param>
/// <param name="ExpiresOn">Moment, po którym adres przestaje działać.</param>
public sealed record ArtifactUploadTicket(Guid Uuid, Uri Url, DateTimeOffset ExpiresOn);

/// <summary>
/// Magazyn plików produkowanych przez system (eksporty, raporty, dokumenty) — patrz
/// <c>docs/backend/exports-artifacts.md</c>.
///
/// <para><b>Zapis idzie przez callback na strumieniu</b>, a nie przez <c>byte[]</c> ani gotowy
/// <c>Stream</c>. Producent eksportu z 50 tys. produktów nie może mieć całego pliku w pamięci,
/// a implementacja musi kontrolować moment otwarcia i zamknięcia zasobu. Ten kształt wymusza
/// jedno i drugie: wołający dostaje strumień, do którego pisze, i nie decyduje o jego cyklu życia.</para>
///
/// <para><b>Docelowo to jest zadanie modułu DMS.</b> Dopóki DMS nie ma backendu, implementacja
/// żyje w <c>Erp.BuildingBlocks.Artifacts</c> i chodzi po MinIO. Ta abstrakcja istnieje po to,
/// żeby przejęcie roli przez DMS nie ruszyło ani jednego producenta.</para>
/// </summary>
public interface IArtifactStore
{
    /// <summary>
    /// Zapisuje artefakt i zwraca jego identyfikator. <paramref name="write"/> dostaje otwarty
    /// strumień docelowy i jest wołane dokładnie raz.
    /// </summary>
    Task<Guid> WriteAsync(
        ArtifactDescriptor descriptor,
        Func<Stream, CancellationToken, Task> write,
        CancellationToken cancellationToken);

    /// <summary>
    /// Wydaje krótko ważną zgodę na zapis pliku <b>bezpośrednio do magazynu</b>, z pominięciem
    /// serwisu.
    ///
    /// <para><b>Dlaczego nie przez endpoint modułu.</b> Zawartość wgrywana przez użytkownika —
    /// w odróżnieniu od artefaktu produkowanego przez <see cref="WriteAsync"/> — przychodzi
    /// z zewnątrz i bywa liczona w setkach megabajtów. Przepuszczenie jej przez proces .NET
    /// oznaczałoby żądanie HTTP trzymane otwarte na czas transferu i drugi komplet bajtów
    /// przechodzący przez serwis bez żadnego pożytku.</para>
    ///
    /// <para><b>Czego ten adres NIE gwarantuje.</b> Serwis nie widzi zawartości, więc w chwili
    /// wydania biletu nie wie ani co zostanie wgrane, ani czy cokolwiek. Typ i rozmiar
    /// deklaruje klient w komendzie opisującej plik, a zweryfikować je można dopiero po fakcie,
    /// przez <see cref="GetMetadataAsync"/> — i to jest cena tej drogi, świadomie zapłacona.</para>
    /// </summary>
    Task<ArtifactUploadTicket> CreateUploadTicketAsync(TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>Otwiera artefakt do odczytu. Wołający zamyka strumień.</summary>
    Task<Stream> OpenAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>Metadane bez pobierania zawartości; <c>null</c>, gdy artefakt nie istnieje.</summary>
    Task<ArtifactMetadata?> GetMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Adres pobrania ważny przez <paramref name="ttl"/>.
    ///
    /// <para><b>Link jest bearer-owy</b> — kto go ma, ten pobiera, niezależnie od uprawnień.
    /// Dlatego generuje się go dopiero na kliknięcie, za sprawdzeniem uprawnienia, z TTL liczonym
    /// w minutach, i nigdy nie zapisuje w rekordzie przebiegu ani w DTO. Link, który przeleżał
    /// tydzień w historii przeglądarki, jest linkiem, którego nikt już nie kontroluje.</para>
    /// </summary>
    Task<Uri> GetDownloadUrlAsync(Guid artifactUuid, TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>Usuwa artefakt. Nie jest błędem, gdy artefaktu już nie ma.</summary>
    Task DeleteAsync(Guid artifactUuid, CancellationToken cancellationToken);
}
