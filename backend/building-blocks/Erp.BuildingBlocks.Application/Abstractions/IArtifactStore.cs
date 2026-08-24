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
