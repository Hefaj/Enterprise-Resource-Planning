namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Opcjonalne rozszerzenie handlera komendy: wczytaj z góry agregaty CAŁEGO chunka,
/// zamiast pozwolić, żeby każdy element pobrał swój osobnym zapytaniem.
///
/// <para><b>Po co.</b> <c>BulkCommandRunner</c> wykonuje elementy chunka po kolei, a handler
/// zaczyna od <c>repository.FindAsync(command.Uuid)</c>. Bez wczytania z góry jest to klasyczne
/// N+1: chunk 500 produktów to 500 zapytań, a przy agregacie z kolekcjami — po jednym zapytaniu
/// NA KOLEKCJĘ, bo globalne <c>SplitQuery</c> rozbija każdy <c>Include</c> na osobny SELECT.
/// Zmierzone na Catalogu: 3000 poleceń SQL i ~1950 ms na chunk, wobec 6 poleceń i ~270 ms
/// po wczytaniu wsadowym (i 1 polecenia, gdy komenda dotyka wyłącznie korzenia).</para>
///
/// <para><b>Dlaczego na handlerze, a nie na egzekutorze.</b> To handler wie, ILE agregatu
/// potrzebuje jego metoda domenowa — zmiana nazwy dotyka samego korzenia, zmiana klasyfikacji
/// podmienia komplet kategorii. Gdyby ta wiedza mieszkała gdzie indziej, rozjechałaby się
/// z rzeczywistym zapytaniem przy pierwszej zmianie handlera, a najgorszy możliwy skutek
/// (agregat wczytany zbyt wąsko oddany metodzie, która podmienia kolekcję) jest cichy.
/// Tutaj deklaracja zakresu i jego użycie stoją obok siebie, w jednej klasie.</para>
///
/// <para><b>Opcjonalne z premedytacją.</b> Handler, który tego nie implementuje, działa
/// dokładnie jak dotąd — <c>BulkCommandExecutor</c> sprawdza interfejs rzutowaniem i przy
/// jego braku nie robi nic. Moduł bez wczytywania wsadowego niczego nie musi zmieniać.</para>
///
/// <para><b>To jest wyłącznie optymalizacja.</b> Poprawność nie może od niej zależeć:
/// <c>PreloadAsync</c> ma wypełnić jednostkę pracy, a <c>ExecuteAsync</c> musi nadal działać
/// poprawnie, gdy wczytania z góry nie było (pojedyncza komenda z endpointu HTTP, element
/// w trybie izolacji po awarii zapisu). Repozytorium odpowiada za to, żeby przy zbyt wąskim
/// albo brakującym wczytaniu zejść do zwykłego zapytania.</para>
/// </summary>
public interface IBulkPreloadingHandler
{
    /// <summary>
    /// Wczytuje agregaty chunka do bieżącej jednostki pracy jednym zapytaniem.
    /// </summary>
    /// <param name="aggregateUuids">Agregaty chunka, już odduplikowane przez runnera.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task PreloadAsync(IReadOnlyCollection<Guid> aggregateUuids, CancellationToken cancellationToken);
}
