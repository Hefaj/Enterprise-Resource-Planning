namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Pojedynczy cel operacji masowej: agregat plus opcjonalny payload komendy tylko dla niego.
/// </summary>
/// <param name="AggregateUuid">Agregat, na którym ma zostać wykonana komenda.</param>
/// <param name="CommandJson">Payload specyficzny dla tego celu; <c>null</c> oznacza użycie
/// szablonu zadania. Rozróżnienie odwzorowuje dwa tryby kontraktu <c>BatchCommand</c>:
/// „ta sama komenda dla wielu celów” i „lista różnych komend”.</param>
public readonly record struct JobTarget(Guid AggregateUuid, string? CommandJson = null);
