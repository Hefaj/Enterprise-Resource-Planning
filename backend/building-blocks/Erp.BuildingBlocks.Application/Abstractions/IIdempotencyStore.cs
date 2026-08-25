namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>Zapamiętany wynik operacji wykonanej wcześniej pod tym samym kluczem.</summary>
/// <param name="Key">Klucz idempotencji.</param>
/// <param name="Operation">Nazwa operacji (typ komendy albo typ zadania) — służy wyłącznie
/// diagnostyce i wykryciu ponownego użycia tego samego identyfikatora do czegoś innego.</param>
/// <param name="ResultJson">Serializowany wynik pierwszego wykonania.</param>
public sealed record IdempotentOperation(string Key, string Operation, string? ResultJson);

/// <summary>
/// Rejestr wykonanych operacji: klucz z nagłówka <c>X-Request-Id</c> → wynik pierwszego wykonania.
///
/// <para><b>Zapis jest celowo dwutaktowy</b> — <see cref="Stage"/> tylko dokłada wpis do bieżącej
/// jednostki pracy, a zatwierdza go ten, kto jest właścicielem transakcji. Klucz idempotencji
/// MUSI trafić do tej samej transakcji co skutek, który odtwarza: zapisany wcześniej blokowałby
/// operację, która nigdy się nie wykonała, zapisany później zostawiałby okno, w którym powtórka
/// wykonuje wszystko po raz drugi. Osobne <c>SaveChanges</c> wewnątrz magazynu odebrałoby
/// tę gwarancję, więc go tu nie ma.</para>
/// </summary>
public interface IIdempotencyStore
{
    /// <summary>Szuka wyniku zapamiętanego pod kluczem; <c>null</c>, gdy operacji jeszcze nie było
    /// (albo gdy wpis zdążył wygasnąć).</summary>
    Task<IdempotentOperation?> FindAsync(string key, CancellationToken cancellationToken);

    /// <summary>
    /// Dokłada wpis do bieżącej jednostki pracy. Zatwierdzenie należy do właściciela transakcji.
    /// </summary>
    /// <param name="key">Klucz idempotencji.</param>
    /// <param name="operation">Nazwa operacji — typ komendy albo typ zadania masowego.</param>
    /// <param name="userId">Kto wykonał; wyłącznie do diagnostyki.</param>
    /// <param name="resultJson">Serializowany wynik do oddania przy powtórce.</param>
    void Stage(string key, string operation, string? userId, string? resultJson);
}
