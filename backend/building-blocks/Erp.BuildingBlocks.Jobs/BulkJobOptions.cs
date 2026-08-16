namespace Erp.BuildingBlocks.Jobs;

/// <summary>Strojenie silnika zadań masowych; sekcja <c>BulkJobs</c> w appsettings.</summary>
public sealed class BulkJobOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "BulkJobs";

    /// <summary>
    /// Liczba elementów przetwarzanych w jednym przebiegu (i w jednej transakcji).
    ///
    /// Kompromis: większy chunk to mniej commitów i mniej zdarzeń postępu, ale dłuższa
    /// transakcja, dłużej trzymane blokady wierszy i grubszy zakres do powtórzenia,
    /// gdy chunk trzeba rozbić na pojedyncze elementy po konflikcie.
    /// </summary>
    public int ChunkSize { get; set; } = 500;

    /// <summary>
    /// Do ilu porcji rozbić zadanie MNIEJSZE niż <see cref="ChunkSize"/>, żeby postęp
    /// był widoczny w trakcie, a nie dopiero na końcu.
    ///
    /// <para>Zdarzenie <c>JobProgressed</c> jedzie przez outbox, więc pokazuje się dopiero
    /// po zatwierdzeniu chunka — przy jednym chunku na całe zadanie użytkownik widzi „0/5"
    /// aż do zakończenia. Ten parametr wyznacza chunk jako <c>ceil(total / target)</c>,
    /// przycięty do przedziału [<see cref="MinChunkSize"/>, <see cref="ChunkSize"/>].</para>
    ///
    /// <para>Duże zadania nie odczuwają zmiany: dla 50 tys. elementów i celu 10 wyszłoby
    /// 5 tys., czyli powyżej <see cref="ChunkSize"/>, więc obowiązuje dotychczasowe 500.
    /// Płacą wyłącznie małe wsady — kilka commitów zamiast jednego, przy kilku elementach
    /// koszt pomijalny. Wartość ≤ 1 wyłącza mechanizm.</para>
    /// </summary>
    public int ProgressUpdateTarget { get; set; } = 10;

    /// <summary>Dolna granica wyliczonego chunka — zabezpiecza przed transakcją na element
    /// przy nieroztropnie wysokim <see cref="ProgressUpdateTarget"/>.</summary>
    public int MinChunkSize { get; set; } = 1;

    /// <summary>Maksymalna liczba prób dla pojedynczego elementu, zanim zostanie uznany
    /// za trwale nieudany.</summary>
    public int MaxAttempts { get; set; } = 3;

    /// <summary>Odstęp odpytywania bazy o nowe zadania, gdy kolejka jest pusta.</summary>
    public TimeSpan IdlePollingInterval { get; set; } = TimeSpan.FromSeconds(2);
}
