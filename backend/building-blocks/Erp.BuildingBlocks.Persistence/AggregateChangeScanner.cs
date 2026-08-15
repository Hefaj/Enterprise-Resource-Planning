using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Wyprowadza zdarzenia <see cref="AggregateChanged"/> wprost z ChangeTrackera EF Core.
///
/// Dlaczego automatycznie, a nie ręcznie w każdej komendzie — patrz
/// <see cref="IAggregateSignatureMap"/>. W skrócie: powiadomienie o zmianie ma być
/// nieodłączne od zapisu, żeby nie dało się go pominąć.
///
/// <para>
/// Najważniejszy przypadek brzegowy, który ta klasa obsługuje: <b>zmiana wyłącznie w dziecku
/// agregatu</b>. Gdy komenda modyfikuje kolekcję owned (np. gwarancje produktu), EF oznacza
/// jako <c>Modified</c> encję-dziecko, a korzeń zostaje <c>Unchanged</c>. Naiwny skan
/// „weź wpisy będące AggregateRoot” nie zwróciłby wtedy nic i produkt cicho nie odświeżyłby się
/// u klientów — dokładnie ta klasa błędu, której ten mechanizm ma zapobiegać. Dlatego dla każdego
/// zmienionego wpisu wchodzimy po relacji własności aż do korzenia agregatu.
/// </para>
/// </summary>
public static class AggregateChangeScanner
{
    /// <summary>
    /// Zbiera zmiany oczekujące w ChangeTrackerze i grupuje je w zdarzenia — jedno na parę
    /// (sygnatura, rodzaj zmiany), z listą identyfikatorów. Grupowanie jest istotne: bulk
    /// zapisujący chunk 500 produktów wygeneruje jedno zdarzenie z 500 uuid, a nie 500 zdarzeń.
    /// </summary>
    /// <param name="changeTracker">ChangeTracker kontekstu tuż PRZED zapisem.</param>
    /// <param name="signatureMap">Mapa typ agregatu → sygnatura kanału.</param>
    /// <param name="correlationId">Korelacja bieżącej operacji.</param>
    /// <param name="occurredAt">Znacznik czasu zdarzeń.</param>
    public static IReadOnlyList<AggregateChanged> Scan(
        ChangeTracker changeTracker,
        IAggregateSignatureMap signatureMap,
        Guid correlationId,
        DateTimeOffset occurredAt)
    {
        ArgumentNullException.ThrowIfNull(changeTracker);
        ArgumentNullException.ThrowIfNull(signatureMap);

        // (sygnatura, rodzaj zmiany) → zbiór uuid. HashSet, bo zmiana korzenia i jego dwojga
        // dzieci w jednym zapisie to nadal jedna zmiana jednego agregatu.
        var buckets = new Dictionary<(string Signature, ChangeType Change), HashSet<Guid>>();

        foreach (var entry in changeTracker.Entries())
        {
            var change = entry.State switch
            {
                EntityState.Added or EntityState.Modified => ChangeType.Upserted,
                EntityState.Deleted => ChangeType.Deleted,
                _ => (ChangeType?)null,
            };

            if (change is null)
            {
                continue;
            }

            if (!TryResolveAggregate(entry, signatureMap, out var signature, out var uuid))
            {
                continue;
            }

            // Usunięcie dziecka nie jest usunięciem agregatu — korzeń nadal istnieje,
            // tylko w zmienionej postaci.
            var effectiveChange = IsAggregateRootEntry(entry) ? change.Value : ChangeType.Upserted;

            var key = (signature, effectiveChange);
            if (!buckets.TryGetValue(key, out var uuids))
            {
                uuids = [];
                buckets[key] = uuids;
            }

            uuids.Add(uuid);
        }

        if (buckets.Count == 0)
        {
            return [];
        }

        return [.. buckets.Select(kvp => new AggregateChanged(
            kvp.Key.Signature,
            [.. kvp.Value],
            kvp.Key.Change,
            correlationId,
            occurredAt))];
    }

    private static bool IsAggregateRootEntry(EntityEntry entry)
        => typeof(AggregateRoot).IsAssignableFrom(entry.Metadata.ClrType);

    /// <summary>
    /// Szuka klucza obcego prowadzącego wprost do korzenia agregatu — odpowiednik
    /// <c>FindOwnership()</c> dla dzieci mapowanych jako zwykłe encje.
    ///
    /// <para>Wymagana JEDNOZNACZNOŚĆ: przy kilku kluczach obcych do korzeni agregatów nie da się
    /// rozstrzygnąć, którego agregatu dana encja jest częścią, a zgadywanie oznaczałoby
    /// rozgłaszanie zmiany nie tego agregatu. W takim przypadku świadomie zwracamy <c>null</c>
    /// — moduł musi wtedy wypublikować zdarzenie jawnie. Ta sama zasada, którą kierują się
    /// zagnieżdżone typy owned niżej: jawne pominięcie jest lepsze od cichej pomyłki.</para>
    ///
    /// <para>Encje niebędące częścią żadnego agregatu (tabele pomocnicze w rodzaju domknięcia
    /// drzewa) nie mają takiego klucza i po prostu nie generują zdarzeń.</para>
    /// </summary>
    private static IForeignKey? FindAggregateForeignKey(EntityEntry entry)
    {
        IForeignKey? found = null;

        foreach (var foreignKey in entry.Metadata.GetForeignKeys())
        {
            if (!typeof(AggregateRoot).IsAssignableFrom(foreignKey.PrincipalEntityType.ClrType))
            {
                continue;
            }

            if (found is not null)
            {
                return null;
            }

            found = foreignKey;
        }

        return found;
    }

    /// <summary>
    /// Ustala, do którego agregatu należy zmieniony wpis i jaki ma on identyfikator.
    /// Dla korzenia to on sam; dla encji owned wspinamy się po łańcuchu własności, czytając
    /// wartość klucza obcego wskazującego właściciela. Czytanie FK zamiast szukania wpisu
    /// właściciela w ChangeTrackerze jest celowe — właściciel bywa <c>Unchanged</c> i wcale
    /// nie musi być załadowany.
    /// </summary>
    private static bool TryResolveAggregate(
        EntityEntry entry,
        IAggregateSignatureMap signatureMap,
        out string signature,
        out Guid uuid)
    {
        signature = string.Empty;
        uuid = Guid.Empty;

        if (IsAggregateRootEntry(entry))
        {
            if (!signatureMap.TryGetSignature(entry.Metadata.ClrType, out signature))
            {
                return false;
            }

            var value = entry.Property(nameof(Entity.Uuid)).CurrentValue;
            if (value is not Guid rootUuid || rootUuid == Guid.Empty)
            {
                return false;
            }

            uuid = rootUuid;
            return true;
        }

        // Dziecko agregatu — właścicielem jest korzeń, a klucz obcy po stronie dziecka
        // niesie jego identyfikator.
        //
        // Dwie ścieżki, bo dziecko nie musi być typem owned. Kolekcje wewnętrzne `Product`
        // (kategorie, multimedia, gwarancje) są mapowane jako ZWYKŁE encje w relacji
        // jeden-do-wielu — EF nie śledzi tożsamości dzieci kolekcji owned między przebiegami
        // wykrywania zmian i gubi wstawienia (szczegóły przy `ProductConfiguration`).
        // Gdyby ten skaner rozpoznawał wyłącznie `FindOwnership()`, zmiana samych kategorii
        // przestałaby rozgłaszać `AggregateChanged` i produkt nie odświeżyłby się u klientów —
        // dokładnie ta klasa cichego błędu, przed którą ta klasa ma chronić.
        var ownership = entry.Metadata.FindOwnership() ?? FindAggregateForeignKey(entry);
        if (ownership is null)
        {
            return false;
        }

        var principalType = ownership.PrincipalEntityType;

        // Zagnieżdżone typy owned (owned wewnątrz owned) świadomie NIE są obsługiwane:
        // klucz obcy dziecka wskazuje wtedy pośrednika, nie korzeń, a rozstrzygnięcie
        // wymagałoby wpisu właściciela, który wcale nie musi być śledzony. Model, w którym
        // to wystąpi, powinien albo spłaszczyć zagnieżdżenie, albo moduł musi wypublikować
        // AggregateChanged jawnie. Cisza w tym miejscu byłaby gorsza niż jawne pominięcie,
        // dlatego test architektoniczny pilnuje, że takie mapowanie nie powstaje niezauważone.
        if (!typeof(AggregateRoot).IsAssignableFrom(principalType.ClrType))
        {
            return false;
        }

        if (!signatureMap.TryGetSignature(principalType.ClrType, out signature))
        {
            return false;
        }

        var ownerKeyValue = entry.Property(ownership.Properties[0].Name).CurrentValue;
        if (ownerKeyValue is not Guid ownerUuid || ownerUuid == Guid.Empty)
        {
            return false;
        }

        uuid = ownerUuid;
        return true;
    }
}
