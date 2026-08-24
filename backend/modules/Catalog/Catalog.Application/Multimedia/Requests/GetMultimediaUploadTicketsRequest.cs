namespace Catalog.Application.Multimedia;

/// <summary>
/// Prośba o adresy, pod które przeglądarka wgra pliki.
///
/// <para>Liczba, a nie lista nazw plików: adres jest podpisem na zapis pod konkretnym
/// identyfikatorem i nie zależy od tego, co pod niego pojedzie. Nazwę pliku serwis pozna
/// dopiero z komendy <c>MultimediaCreateCommand</c>, po zakończonym transferze.</para>
/// </summary>
public sealed class GetMultimediaUploadTicketsRequest
{
    /// <summary>Ile plików użytkownik zamierza wgrać.</summary>
    public int Count { get; set; } = 1;
}

/// <summary>Jednorazowa zgoda na wgranie jednego pliku.</summary>
/// <param name="ArtifactUuid">Identyfikator, który wraca potem w <c>MultimediaCreateCommand</c>.</param>
/// <param name="UploadUrl">Adres, pod który idzie <c>PUT</c> z zawartością pliku.</param>
/// <param name="ExpiresOn">Moment, po którym adres przestaje działać.</param>
public sealed record MultimediaUploadTicketDto(Guid ArtifactUuid, string UploadUrl, DateTime ExpiresOn);

/// <summary>Rejestracja paczki wgranych plików w katalogu.</summary>
public sealed class MultimediaCreateRequest
{
    /// <summary>Po jednej komendzie na plik; uuid nadaje klient.</summary>
    public List<MultimediaCreateCommand> Commands { get; set; } = [];
}

/// <summary>Identyfikatory założonych zasobów, w kolejności z żądania.</summary>
/// <param name="Uuids">Uuidy zasobów — klient dopina je potem do produktów.</param>
public sealed record MultimediaCreateResponse(List<Guid> Uuids);

/// <summary>Pobranie zawartości zasobu.</summary>
public sealed class GetMultimediaContentRequest
{
    /// <summary>Zasób w katalogu — NIE identyfikator artefaktu w magazynie.</summary>
    public Guid Uuid { get; set; }
}
