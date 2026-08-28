namespace TaskManagement.Infrastructure.Persistence.Graph;

/// <summary>
/// Wiersze wyników rekurencyjnych CTE grafu zgłoszeń.
///
/// <para>To zwykłe typy wynikowe dla <c>Database.SqlQuery&lt;T&gt;</c>, nie encje EF: istnieją
/// wyłącznie po to, żeby zmaterializować wynik zapytania, którego nie da się wyrazić w LINQ.
/// Nie są rejestrowane w modelu i nie mają odpowiednika w bazie ani śladu w migracjach.</para>
///
/// <para>Dlaczego CTE, a nie graf w pamięci — <c>docs/backend/task-management.md</c> §8.2:
/// drzewo i graf blokad w dużym projekcie mają tysiące krawędzi, a reguła wsadowa musi
/// działać także w pre-checku operacji masowej.</para>
/// </summary>
public sealed class GraphEdgeRow
{
    /// <summary>Zgłoszenie, od którego zaczynało się przejście grafu.</summary>
    public Guid SeedUuid { get; set; }

    /// <summary>Zgłoszenie osiągnięte z <see cref="SeedUuid"/>.</summary>
    public Guid ReachedUuid { get; set; }
}

/// <summary>Wiersz poddrzewa: zgłoszenie, jego poziom zagnieżdżenia i korzeń, z którego
/// wyszło przejście — tryb drzewa na liście zgłoszeń.</summary>
public sealed class SubtreeRow
{
    public Guid Uuid { get; set; }

    public int Level { get; set; }

    public Guid RootUuid { get; set; }
}
