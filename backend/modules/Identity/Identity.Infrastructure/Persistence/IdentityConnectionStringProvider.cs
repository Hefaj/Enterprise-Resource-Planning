namespace Identity.Infrastructure.Persistence;

/// <summary>
/// Łańcuch połączenia dla zapytań surowym SQL-em (rekursywne CTE, patrz
/// <c>RoleQueries.IsDescendantAsync</c>, <c>UserAccountQueries.GetEffectivePermission*Async</c>).
///
/// Celowo NIE czytany z <c>_dbContext.Database.GetDbConnection().ConnectionString</c> — Npgsql
/// domyślnie NIE utrzymuje hasła w reprezentacji tekstowej połączenia po jego otwarciu
/// (<c>Persist Security Info=false</c>), więc odczyt connection stringa z połączenia, którym
/// EF już zdążył się gdziekolwiek posłużyć (np. przy migracji na starcie), po cichu zwraca
/// łańcuch BEZ hasła — kolejne otwarcie nowego połączenia z tym okrojonym stringiem kończy się
/// błędem SASL "No password has been provided" dopiero w runtime, przy pierwszym zapytaniu.
/// Zamiast tego moduł trzyma oryginalny, kompletny łańcuch osobno.
/// </summary>
public sealed class IdentityConnectionStringProvider
{
    public IdentityConnectionStringProvider(string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        ConnectionString = connectionString;
    }

    public string ConnectionString { get; }
}
