using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Application.Multimedia;

/// <summary>
/// Ponowne zlecenie wygenerowania wariantów pochodnych (miniaturka, podgląd) dla zasobu,
/// który już jest w katalogu.
///
/// <para><b>Dlaczego <c>Exec</c>, a nie <c>Set</c>.</b> Komenda nie nadpisuje żadnego plastra
/// stanu agregatu — sam zasób po jej wykonaniu wygląda tak samo. Zmienia się dopiero to, co
/// leży w magazynie, i to nie tutaj, tylko w konsumencie
/// (<c>docs/backend/endpoint-naming.md</c> §5).</para>
///
/// <para><b>Po co to w ogóle jest.</b> Zlecenie generowania wychodzi normalnie raz, przy
/// rejestracji pliku (<see cref="MultimediaCreateCommandHandler"/>). Zasoby wgrane, zanim
/// generator zaczął działać — albo takie, dla których dekodowanie padło przy pierwszym
/// podejściu — zostają bez wariantów na zawsze, bo to zdarzenie nigdy się nie powtarza.
/// Bez tej komendy jedynym sposobem nadrobienia jest wgranie pliku od nowa
/// (<c>docs/backend/media-storage.md</c> §8).</para>
///
/// <para><b>Bezpieczna do ponowienia</b>, mimo czasownika <c>Exec</c>: warianty zapisują się
/// pod deterministycznym kluczem, więc powtórka nadpisuje ten sam obiekt tą samą treścią.
/// <c>job/retry-failed</c> może ją ponawiać bez zastrzeżeń.</para>
/// </summary>
public sealed class MultimediaExecGenerateDerivativesCommand : ICommand<Guid>, IAggregateCommand
{
    /// <inheritdoc />
    public Guid Uuid { get; set; }
}
