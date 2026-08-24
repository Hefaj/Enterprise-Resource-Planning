using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Zarejestrowanie w katalogu pliku, który leży już w magazynie artefaktów.
///
/// <para><b>To jest drugi krok wgrywania, nie całe wgrywanie.</b> Bajty idą wcześniej prosto
/// z przeglądarki do magazynu, pod adres wydany przez <c>getMultimediaUploadTicket</c> — dopiero
/// ta komenda nadaje im tożsamość w katalogu. Podział jest celowy: przepuszczenie zawartości
/// przez endpoint modułu oznaczałoby żądanie HTTP trzymane otwarte na czas transferu
/// (patrz <c>IArtifactStore.CreateUploadTicketAsync</c>).</para>
///
/// <para><c>Uuid</c> generuje klient — jest kluczem idempotencji, tak samo jak przy każdym
/// innym <c>Create</c> (<c>docs/backend/endpoint-naming.md</c> §4). Dzięki temu ponowione
/// żądanie po zerwanym połączeniu nie zakłada drugiego wpisu na ten sam plik.</para>
///
/// <para><b>Czego tu nie ma i dlaczego.</b> Rozmiaru ani typu MIME klient nie deklaruje: serwis
/// odczytuje je z magazynu, bo tylko tam jest prawda o tym, co faktycznie zostało wgrane.</para>
/// </summary>
public sealed class MultimediaCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }

    /// <summary>Artefakt w magazynie, wskazany przez bilet wgrywania.</summary>
    public Guid ArtifactUuid { get; set; }

    /// <summary>Nazwa pliku z dysku użytkownika — magazyn jej nie zna, adres jest podpisem.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Pozycja w galerii.</summary>
    public int SortOrder { get; set; }
}
