namespace Erp.BuildingBlocks.Contracts;

/// <summary>
/// Prośba o skasowanie obiektu w magazynie plików, wypuszczana w tej samej transakcji, co
/// usunięcie rekordu, który go opisywał.
///
/// <para><b>Po co przez outbox, skoro konsument jest w tym samym procesie.</b> Baza i magazyn
/// nie są w jednej transakcji, więc zawsze istnieje moment, w którym wiersz zniknął, a
/// <c>DeleteObject</c> padł albo się nie wykonał. Wywołanie magazynu wprost z handlera zostawia
/// wtedy obiekt-sierotę bez śladu w systemie; koperta zapisana z danymi przeżyje restart
/// i doczeka się ponowienia. Dostarczenie jest <i>at-least-once</i>, a to tutaj dokładnie
/// właściwa semantyka: usunięcie nieistniejącego obiektu jest idempotentne.</para>
///
/// <para><b>Dlaczego z polem <see cref="Module"/>.</b> Wymiana <c>erp.events</c> jest fanoutowa —
/// tę kopertę dostaną wszystkie mikroserwisy, a każdy ma własne kubełki. Bez dyskryminatora
/// handler sąsiada próbowałby skasować u siebie obiekt o tym samym identyfikatorze. Handler ma
/// obowiązek odrzucić kopertę spoza swojego modułu.</para>
///
/// <para>Kontrakt publiczny, wersjonowany — wolno wyłącznie dodawać pola
/// (<c>docs/backend/events-outbox.md</c>).</para>
/// </summary>
/// <param name="Module">Moduł-właściciel magazynu, np. <c>Catalog</c>. Zgodny z
/// <c>Messaging:ServiceName</c>.</param>
/// <param name="StoreKey">Klucz magazynu w obrębie modułu (<c>ArtifactStoreKeys</c>) — bo moduł
/// ma ich kilka i obiekt trzeba skasować w tym właściwym.</param>
/// <param name="ArtifactUuid">Obiekt do skasowania.</param>
public sealed record ArtifactDeletionRequested(string Module, string StoreKey, Guid ArtifactUuid);
