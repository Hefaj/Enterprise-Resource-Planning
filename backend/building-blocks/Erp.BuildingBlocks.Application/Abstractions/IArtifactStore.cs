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
/// Pozycja z listowania magazynu — na tyle uboga, na ile pozwala S3 bez odpytywania o każdy
/// obiekt z osobna. Używa tego wyłącznie audytor rozjazdu
/// (<c>docs/backend/media-storage.md</c> §4d), któremu do decyzji wystarczy tożsamość i wiek.
/// </summary>
/// <param name="Uuid">Identyfikator artefaktu wyprowadzony z klucza obiektu.</param>
/// <param name="LastModified">Znacznik czasu z magazynu; <c>null</c>, gdy magazyn go nie podał.</param>
/// <param name="SizeBytes">Rozmiar obiektu.</param>
public sealed record ArtifactListEntry(Guid Uuid, DateTimeOffset? LastModified, long SizeBytes);

/// <summary>
/// Klucze, po których konsument wybiera magazyn. Odpowiadają wpisom w sekcji
/// <c>Artifacts:Stores</c> konfiguracji modułu.
///
/// <para>Rejestracja bez klucza to magazyn artefaktów wygasających (<see cref="Transient"/>) —
/// domyślny, bo taki jest każdy plik produkowany przez system. Zawartość trwała musi o siebie
/// poprosić jawnie, przez <see cref="Media"/>; odwrotny domyślny doprowadziłby do cichego
/// wydłużenia życia eksportów, zamiast do głośnego błędu kompilacji.</para>
/// </summary>
public static class ArtifactStoreKeys
{
    /// <summary>
    /// Magazyn plików produkowanych przez system — eksportów, raportów. Obowiązuje w nim reguła
    /// wygasania. Zarejestrowany jednocześnie jako rejestracja <b>bez klucza</b>, czyli domyślna.
    /// </summary>
    public const string Transient = "transient";

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
/// Magazyn plików jednego modułu — patrz <c>docs/backend/media-storage.md</c>.
///
/// <para><b>Każdy moduł rozmawia z magazynem sam.</b> Nie ma i nie będzie centralnego
/// mikroserwisu plików: żeby bezpiecznie usunąć plik, trzeba wiedzieć, czy ktoś go jeszcze
/// używa, a referencja żyje w schemacie modułu biznesowego. Rozproszony licznik referencji
/// byłby licznikiem kasującym żywe dane w oknie opóźnienia
/// (<c>media-storage.md</c> §1).</para>
///
/// <para><b>Dwie drogi zapisu, świadomie różne.</b> <see cref="WriteAsync"/> przyjmuje zawartość
/// od producenta wewnątrz procesu (eksport, raport). <see cref="CreateUploadTicketAsync"/> +
/// <see cref="PromoteAsync"/> obsługują plik przychodzący z przeglądarki, którego bajty nigdy
/// nie przechodzą przez proces .NET.</para>
///
/// <para><b>Dwa prefiksy w kubełku.</b> Bilet celuje w <c>staging/</c>, potwierdzony plik żyje
/// w <c>assets/</c>. Wszystkie metody poza rodziną „staged" operują na <c>assets/</c>. To
/// rozdzielenie jest całym mechanizmem sprzątania obiektów, po których nie przyszła komenda:
/// obiekt niepotwierdzony umiera z reguły lifecycle na <c>staging/</c>, a nie od kodu, który
/// mógłby się pomylić (<c>media-storage.md</c> §4a).</para>
/// </summary>
public interface IArtifactStore
{
    /// <summary>
    /// Zapisuje artefakt produkowany przez system i zwraca jego identyfikator. Plik ląduje od
    /// razu w <c>assets/</c> — nie przechodzi przez prefiks postojowy, bo producent jest
    /// wewnątrz procesu i nie ma tu czego potwierdzać.
    ///
    /// <para><b>Zapis idzie przez callback na strumieniu</b>, a nie przez <c>byte[]</c> ani
    /// gotowy <c>Stream</c>. Producent eksportu z 50 tys. produktów nie może mieć całego pliku
    /// w pamięci, a implementacja musi kontrolować moment otwarcia i zamknięcia zasobu.</para>
    /// </summary>
    Task<Guid> WriteAsync(
        ArtifactDescriptor descriptor,
        Func<Stream, CancellationToken, Task> write,
        CancellationToken cancellationToken);

    /// <summary>
    /// Wydaje krótko ważną zgodę na zapis pliku <b>bezpośrednio do magazynu</b>, pod prefiks
    /// postojowy <c>staging/</c>.
    ///
    /// <para><b>Dlaczego nie przez endpoint modułu.</b> Zawartość wgrywana przez użytkownika
    /// przychodzi z zewnątrz i bywa liczona w setkach megabajtów. Przepuszczenie jej przez
    /// proces .NET oznaczałoby żądanie HTTP trzymane otwarte na czas transferu i drugi komplet
    /// bajtów przechodzący przez serwis bez żadnego pożytku.</para>
    ///
    /// <para><b>Czego ten adres NIE gwarantuje.</b> Serwis nie widzi zawartości, więc w chwili
    /// wydania biletu nie wie ani co zostanie wgrane, ani czy cokolwiek. Prawdę o pliku daje
    /// dopiero <see cref="GetStagedMetadataAsync"/> po zakończonym transferze.</para>
    /// </summary>
    Task<ArtifactUploadTicket> CreateUploadTicketAsync(TimeSpan ttl, CancellationToken cancellationToken);

    /// <summary>
    /// Metadane obiektu leżącego pod prefiksem postojowym; <c>null</c>, gdy nic tam nie dotarło.
    ///
    /// <para>To jest <b>walidacja, nie uzupełnianie danych</b>: bilet jest bearer-owy i wydany
    /// z góry, więc komenda rejestrująca może wskazać artefakt, którego nikt nie wgrał. Rozmiar
    /// i typ MIME stąd — a nie z deklaracji klienta — są jedyną wiarygodną informacją o tym,
    /// co faktycznie wylądowało w magazynie.</para>
    /// </summary>
    Task<ArtifactMetadata?> GetStagedMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Przenosi potwierdzony obiekt z <c>staging/</c> do <c>assets/</c>, po stronie magazynu
    /// (<c>CopyObject</c> + skasowanie źródła) — <b>bajty nie przechodzą przez proces .NET</b>.
    ///
    /// <para>Wołane w komendzie rejestrującej plik, po odczycie metadanych i po walidacji.
    /// Obiekt, który nigdy nie został promowany, znika sam z reguły lifecycle na prefiksie
    /// postojowym.</para>
    /// </summary>
    Task PromoteAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Kasuje obiekt spod prefiksu postojowego. Wołane, gdy plik został wgrany, ale komenda go
    /// odrzuciła (np. przekroczony limit rozmiaru) — reguła lifecycle zrobiłaby to samo,
    /// tyle że po dobie.
    /// </summary>
    Task DeleteStagedAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Przepisuje zawartość artefaktu wprost do <paramref name="target"/>; <c>false</c>, gdy
    /// obiektu nie ma. Wołający odpowiada za nagłówki odpowiedzi.
    ///
    /// <para><b>Świadomie zamiast zwracania <c>Stream</c>-a.</b> Klient S3 oddaje zawartość
    /// callbackiem, więc oddanie strumienia wymagałoby przełożenia jej przez plik tymczasowy —
    /// pełny round-trip po dysku na każdą miniaturkę w galerii. Tutaj bajty idą prosto z magazynu
    /// do ciała odpowiedzi.</para>
    /// </summary>
    Task<bool> ReadToAsync(Guid artifactUuid, Stream target, CancellationToken cancellationToken);

    /// <summary>Metadane bez pobierania zawartości; <c>null</c>, gdy artefakt nie istnieje.</summary>
    Task<ArtifactMetadata?> GetMetadataAsync(Guid artifactUuid, CancellationToken cancellationToken);

    /// <summary>
    /// Wylicza artefakty leżące pod <c>assets/</c>. Wyłącznie na potrzeby audytora rozjazdu —
    /// ścieżka gorąca adresuje artefakty po identyfikatorze z rekordu, nigdy przez listowanie.
    /// </summary>
    IAsyncEnumerable<ArtifactListEntry> ListAsync(CancellationToken cancellationToken);

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
