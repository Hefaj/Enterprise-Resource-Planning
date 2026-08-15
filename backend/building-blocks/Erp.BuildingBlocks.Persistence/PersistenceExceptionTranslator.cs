using System.Diagnostics.CodeAnalysis;
using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Tłumaczy awarię zapisu na naruszenie reguły biznesowej — jeśli nią faktycznie jest.
///
/// <para><b>Po co.</b> Reguły oparte na unikalności (SKU, sygnatura duplikatu) muszą być
/// wymuszone w bazie, bo dwie równoległe komendy przeszłyby walidację aplikacyjną obie.
/// Skutek uboczny: ich naruszenie przychodzi jako <see cref="DbUpdateException"/> —
/// wyjątek techniczny, który w raporcie z operacji masowej ląduje jako <c>persistence_error</c>
/// i jest ponawiany, bo nikt nie wie, że jest trwały. Użytkownik dostaje wtedy
/// „1200 × persistence_error” zamiast „1200 × product_duplicate”, czyli komunikat, z którym
/// nie da się nic zrobić.</para>
///
/// <para>Translator zamyka tę lukę: odrzucenie z pre-checku wsadowego i naruszenie indeksu
/// przy zapisie trafiają do raportu pod tym samym kodem.</para>
/// </summary>
public interface IPersistenceExceptionTranslator
{
    /// <summary>
    /// Próbuje rozpoznać w awarii zapisu naruszenie znanej reguły biznesowej.
    /// </summary>
    /// <returns><c>true</c>, jeśli udało się przypisać kod domenowy.</returns>
    bool TryTranslate(DbUpdateException exception, [NotNullWhen(true)] out DomainException? translated);
}

/// <summary>
/// Implementacja dla Postgresa: rozpoznaje naruszenie unikalności (<c>SQLSTATE 23505</c>)
/// i mapuje nazwę indeksu na kod błędu domenowego.
///
/// <para>Mapowanie podaje moduł, a nie building block — nazwy indeksów są jego szczegółem,
/// a kody błędów jego językiem. Constraint spoza mapy zostawiamy nieprzetłumaczony:
/// zgadywanie kodu na podstawie nieznanej nazwy dałoby raport, który wygląda na sensowny,
/// a nie jest.</para>
/// </summary>
public sealed class PostgresExceptionTranslator : IPersistenceExceptionTranslator
{
    /// <summary>Naruszenie ograniczenia unikalności.</summary>
    private const string UniqueViolation = "23505";

    private readonly IReadOnlyDictionary<string, string> _errorCodesByConstraint;

    /// <param name="errorCodesByConstraint">Mapa: nazwa indeksu/ograniczenia w bazie →
    /// kod błędu domenowego (<c>snake_case</c>, ta sama rodzina co
    /// <see cref="DomainException.ErrorCode"/>).</param>
    public PostgresExceptionTranslator(IReadOnlyDictionary<string, string> errorCodesByConstraint)
    {
        ArgumentNullException.ThrowIfNull(errorCodesByConstraint);
        _errorCodesByConstraint = errorCodesByConstraint;
    }

    /// <inheritdoc />
    public bool TryTranslate(DbUpdateException exception, [NotNullWhen(true)] out DomainException? translated)
    {
        translated = null;

        if (exception?.InnerException is not PostgresException postgres)
        {
            return false;
        }

        if (!string.Equals(postgres.SqlState, UniqueViolation, StringComparison.Ordinal))
        {
            return false;
        }

        if (postgres.ConstraintName is null
            || !_errorCodesByConstraint.TryGetValue(postgres.ConstraintName, out var errorCode))
        {
            return false;
        }

        translated = new DomainException(
            errorCode,
            $"Naruszenie unikalności ({postgres.ConstraintName}).",
            exception);

        return true;
    }
}
