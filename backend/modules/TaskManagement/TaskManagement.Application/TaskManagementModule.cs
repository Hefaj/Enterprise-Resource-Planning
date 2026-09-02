namespace TaskManagement.Application;

/// <summary>
/// Tożsamość modułu w komunikatach wychodzących na brokera.
///
/// <para>Wymiana <c>erp.events</c> jest fanoutowa — każdą kopertę dostają wszystkie
/// mikroserwisy. Zdarzenia adresowane do konkretnego modułu (jak
/// <c>ArtifactDeletionRequested</c>, bo kubełki są per moduł) muszą nieść dyskryminator,
/// a nadawca i konsument muszą go brać z tego samego miejsca — literówka rozeszłaby się
/// jako cicho nieskasowany plik (wzorem <c>Catalog.Application.CatalogModule</c>).</para>
/// </summary>
public static class TaskManagementModule
{
    /// <summary>Zgodne z <c>Messaging:ServiceName</c>.</summary>
    public const string Name = "TaskManagement";
}
