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

/// <summary>
/// Prośba o wygenerowanie wariantów pochodnych (miniaturka, podgląd) dla świeżo zarejestrowanego
/// pliku.
///
/// <para><b>Dlaczego przez outbox, a nie w handlerze komendy.</b> Skalowanie obrazu 4K to setki
/// milisekund pracy procesora. Wykonane w komendzie rejestrującej przedłużyłoby o tyle każde
/// żądanie wgrania paczki zdjęć — czyli dokładnie ten moment, w którym użytkownik patrzy na modal
/// i czeka. Przez outbox miniaturka powstaje po zatwierdzeniu transakcji, a UI pokazuje ikonę
/// zastępczą przez te kilka sekund.</para>
///
/// <para><b>Dostarczenie jest <i>at-least-once</i>, więc generowanie musi być idempotentne</b> —
/// i jest: wariant zapisuje się pod deterministycznym kluczem, powtórzenie nadpisuje ten sam plik
/// tą samą zawartością.</para>
///
/// <para>Pole <see cref="Module"/> jest obowiązkowe z tego samego powodu, co w
/// <see cref="ArtifactDeletionRequested"/> — wymiana jest fanoutowa.</para>
/// </summary>
/// <param name="Module">Moduł-właściciel magazynu, zgodny z <c>Messaging:ServiceName</c>.</param>
/// <param name="StoreKey">Klucz magazynu w obrębie modułu (<c>ArtifactStoreKeys</c>).</param>
/// <param name="ArtifactUuid">Obiekt, z którego powstają warianty.</param>
/// <param name="OwnerUuid">Rekord modułu opisujący ten plik — konsument oznacza go po
/// zakończeniu, żeby UI wiedział, że wolno już prosić o wariant.</param>
public sealed record ArtifactDerivativesRequested(
    string Module,
    string StoreKey,
    Guid ArtifactUuid,
    Guid OwnerUuid);
