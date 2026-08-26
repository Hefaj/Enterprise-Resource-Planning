namespace Erp.BuildingBlocks.Application.Messaging;

/// <summary>
/// Sygnał „wyrzuć uprawnienia z cache'u" rozsyłany do <b>wszystkich</b> instancji wszystkich
/// serwisów.
///
/// <para><b>Dlaczego to nie jest zwykłe zdarzenie integracyjne i nie leży w
/// <c>Erp.BuildingBlocks.Contracts</c>.</b> Wymiana <c>erp.events</c> jest fanoutowa, ale wiąże
/// <b>jedną nazwaną kolejkę per serwis</b> — N instancji Catalogu to <i>competing consumers</i>
/// i komunikat dotarłby do JEDNEJ z nich. Unieważnienie cache'u musi trafić do wszystkich, czyli
/// wymaga innego routingu: osobnej wymiany <c>erp.broadcast</c> i kolejki <b>per instancja</b>.
/// Gdyby ten typ leżał w zestawie kontraktów, reguła publikacji „wszystko z tego zestawu na
/// <c>erp.events</c>" złapałaby go automatycznie i wysyłał<b>by</b> się dwiema drogami naraz.</para>
///
/// <para><b>To jedyne miejsce w systemie, gdzie chcemy prawdziwego broadcastu</b> zamiast
/// rozdziału pracy — i warto to nazwać, żeby wzorzec nie rozlał się na resztę handlerów.
/// Każdy inny komunikat ma trafić do jednego wykonawcy, nie do wszystkich.</para>
///
/// <para><b>To optymalizacja czasu reakcji, nie warunek poprawności.</b> Gwarancją pozostaje TTL
/// cache'u (60 s). Zepsuta kolejka unieważnień cofa system do zachowania sprzed tej zmiany —
/// nie może pogorszyć postawy bezpieczeństwa, może ją tylko poprawić.</para>
/// </summary>
/// <param name="UserId">Claim <c>sub</c> użytkownika, którego uprawnienia się zmieniły.
/// <c>null</c> oznacza „nie wiadomo kogo, wyczyść wszystko" — tak wygląda zmiana na poziomie
/// <b>roli</b>, bo lista jej członków nie jest znana w miejscu publikacji, a przy kilkuset
/// użytkownikach wysłanie tysiąca sygnałów byłoby gorsze niż jedno pełne czyszczenie.</param>
/// <param name="OccurredAt">Kiedy zmiana nastąpiła — wyłącznie do diagnostyki.</param>
public sealed record PermissionsInvalidated(string? UserId, DateTimeOffset OccurredAt);

/// <summary>
/// Odbiorca sygnału <see cref="PermissionsInvalidated"/> po stronie serwisu.
///
/// <para>Osobny interfejs, a nie bezpośrednie sięgnięcie po dostawcę uprawnień, bo ten mieszka
/// w <c>Erp.BuildingBlocks.Api</c>, a handler komunikatu — w warstwie komunikatów. Zależność
/// szłaby pod prąd; abstrakcja w <c>Application</c> ustawia ją z powrotem.</para>
///
/// <para>Handler wstrzykuje <b>kolekcję</b> implementacji i woła każdą. Serwis, który nie
/// cache'uje uprawnień (Identity czyta bazę wprost), po prostu nie rejestruje żadnej — i nie
/// potrzebuje do tego implementacji-pustaka ani sztywnej kolejności rejestracji w DI.</para>
/// </summary>
public interface IPermissionCacheInvalidator
{
    /// <param name="userId">Użytkownik do wyrzucenia z cache'u; <c>null</c> — wyczyść wszystko.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task InvalidateAsync(string? userId, CancellationToken cancellationToken);
}
