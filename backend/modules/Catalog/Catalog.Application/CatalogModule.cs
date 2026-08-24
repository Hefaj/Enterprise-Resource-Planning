namespace Catalog.Application;

/// <summary>
/// Tożsamość modułu w komunikatach wychodzących na brokera.
///
/// <para>Wymiana <c>erp.events</c> jest fanoutowa — każdą kopertę dostają wszystkie
/// mikroserwisy. Zdarzenia adresowane do konkretnego modułu (jak
/// <c>ArtifactDeletionRequested</c>, bo kubełki są per moduł) muszą nieść dyskryminator,
/// a nadawca i konsument muszą go brać z tego samego miejsca — literówka rozeszłaby się
/// jako cicho nieskasowany plik.</para>
/// </summary>
public static class CatalogModule
{
    /// <summary>Zgodne z <c>Messaging:ServiceName</c> i z nazwą przekazywaną do <c>AddErpApi</c>.</summary>
    public const string Name = "Catalog";
}
