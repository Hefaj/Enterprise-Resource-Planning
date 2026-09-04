namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Deklaruje, co usługa tła robi, gdy chodzą <b>dwie instancje serwisu</b>.
///
/// <para><b>Po co atrybut, skoro to można opisać w dokumencie.</b> Reguła zapisana wyłącznie
/// w dokumencie prędzej czy później przestaje obowiązywać — nikt jej nie czyta, dopisując
/// czternastą usługę tła. Ten atrybut jest wymagany przez test architektoniczny
/// (<c>BackgroundServiceTests</c>), więc nowa usługa <b>nie skompiluje się w CI</b>, dopóki
/// jej autor nie odpowie na pytanie „a co, gdy uruchomią się dwie". Odpowiedź „nic złego"
/// jest w porządku — nieodpowiedzenie nie jest.</para>
///
/// <para>Atrybut niczego nie wymusza w czasie działania. Jest deklaracją przeczytaną przez test
/// i przez następną osobę, która otworzy ten plik.</para>
/// </summary>
/// <remarks>Patrz <c>docs/architecture/multi-instance.md</c> §3.2.</remarks>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class ClusterSafeAttribute : Attribute
{
    /// <summary>Dlaczego równoległe uruchomienie tej usługi na wielu instancjach jest bezpieczne.</summary>
    /// <param name="reason">Konkretny mechanizm, nie zapewnienie: „dzierżawa
    /// <c>catalog:media-reconciliation</c>", „SKIP LOCKED na wierszu zadania",
    /// „jedno ExecuteDelete, druga instancja usuwa zero wierszy".</param>
    public ClusterSafeAttribute(string reason)
    {
        Reason = reason;
    }

    /// <summary>Uzasadnienie przekazane w konstruktorze.</summary>
    public string Reason { get; }
}
