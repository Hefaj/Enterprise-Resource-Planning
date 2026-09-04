using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Usunięcie zasobu multimedialnego z katalogu — agregatu, nie elementu kolekcji
/// (<c>docs/guides/backend/endpoint-naming.md</c> §2: <c>Remove</c> bez członu usuwa agregat).
///
/// <para><b>Zasób używany przez produkty zostaje.</b> Zerowa liczba referencji nie jest powodem
/// do usunięcia i odwrotnie — niezerowa jest powodem do odmowy. To biblioteka mediów, a nie
/// pole produktu: odpięcie zdjęcia od jednego produktu, żeby przepiąć je do innego, nie jest
/// prośbą o skasowanie pliku (<c>docs/guides/backend/media-storage.md</c> §4c).</para>
///
/// <para><b>Plik w magazynie kasuje się osobno, przez outbox.</b> Handler wypuszcza
/// <c>ArtifactDeletionRequested</c> w tej samej transakcji, co usunięcie wiersza — baza
/// i magazyn nie są w jednej transakcji, więc kasowanie wprost zostawiałoby przy awarii
/// obiekt-sierotę bez śladu w systemie.</para>
/// </summary>
public sealed class MultimediaRemoveCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }
}
