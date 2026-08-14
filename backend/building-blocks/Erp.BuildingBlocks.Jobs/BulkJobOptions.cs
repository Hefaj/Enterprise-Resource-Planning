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

    /// <summary>Maksymalna liczba prób dla pojedynczego elementu, zanim zostanie uznany
    /// za trwale nieudany.</summary>
    public int MaxAttempts { get; set; } = 3;

    /// <summary>Odstęp odpytywania bazy o nowe zadania, gdy kolejka jest pusta.</summary>
    public TimeSpan IdlePollingInterval { get; set; } = TimeSpan.FromSeconds(2);
}
