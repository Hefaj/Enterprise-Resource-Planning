namespace Erp.BuildingBlocks.Validation;

/// <summary>
/// Znacznik kompozytora reguł wsadowych (<c>ProductBatchValidator</c>, <c>RoleBatchValidator</c>…) —
/// klasy, która wie, JAKIE reguły obowiązują dla której operacji masowej.
///
/// <para>Interfejs jest celowo pusty: walidatory nie mają wspólnego kontraktu, bo każdy wystawia
/// metody nazwane po operacjach swojej domeny (<c>ValidateSetPriceAsync</c>,
/// <c>ValidateAddRoleAsync</c>), a endpointy wstrzykują je po typie konkretnym. Jedyne, co
/// jest wspólne, to fakt bycia walidatorem — i to wystarczy, żeby <c>AddErpModule</c>
/// zarejestrował go automatycznie, zamiast czekać, aż ktoś dopisze linijkę w <c>Program.cs</c>.</para>
///
/// <para>Konwencja nazewnicza (sufiks <c>BatchValidator</c>) byłaby tańsza, ale przemianowanie
/// klasy cicho wypisywałoby ją z kontenera — błąd wychodzący dopiero przy pierwszym żądaniu
/// do endpointu masowego. Znacznika pilnuje kompilator.</para>
/// </summary>
public interface IBatchValidator;
