using System.Globalization;
using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.FieldSchemes;

/// <summary>
/// Wartość pola niestandardowego rozłożona na typ zadeklarowany w schemacie.
///
/// <para><b>Po drucie i w jsonb wartość jest tekstem w postaci kanonicznej</b>, a nie
/// polimorficznym JSON-em. Powód jest praktyczny: kontrakt NSwag musi mieć jeden typ na pole
/// (<c>Dictionary&lt;string, string&gt;</c>), a nie union zależny od danych z bazy — inaczej
/// wygenerowany klient nie ma czego zadeklarować. Postać kanoniczna jest niezależna od kultury
/// (liczba z kropką, data w ISO-8601 UTC, użytkownik jako uuid), więc nie da się zapisać
/// wartości, która po odczycie na innej maszynie znaczy co innego.</para>
/// </summary>
public readonly record struct CustomFieldValue(
    string? Text,
    decimal? Number,
    DateTimeOffset? Date,
    Guid? User)
{
    /// <summary>Wartość pusta — pole wyczyszczone. Czyści też swój slot.</summary>
    public static CustomFieldValue Empty => new(null, null, null, null);

    public bool IsEmpty => Text is null && Number is null && Date is null && User is null;

    /// <summary>
    /// Rozkłada surowy tekst wg deklaracji pola. Rzuca <see cref="DomainException"/> na wartości
    /// niepasującej do typu — walidacja jest <b>przed</b> zmianą stanu agregatu, na tym stoi
    /// częściowy sukces operacji masowych.
    /// </summary>
    public static CustomFieldValue Parse(FieldDefinition definition, string? raw)
    {
        ArgumentNullException.ThrowIfNull(definition);

        if (string.IsNullOrWhiteSpace(raw))
        {
            if (definition.IsRequired)
            {
                throw new DomainException(
                    "taskmgmt.field_value_required",
                    $"Pole `{definition.Code}` jest wymagane.");
            }

            return Empty;
        }

        var value = raw.Trim();

        switch (definition.DataType)
        {
            case CustomFieldDataType.Text:
                return new CustomFieldValue(value, null, null, null);

            case CustomFieldDataType.Select:
                if (!definition.Options.Contains(value, StringComparer.Ordinal))
                {
                    throw new DomainException(
                        "taskmgmt.field_value_not_in_options",
                        $"`{value}` nie jest jedną z dopuszczalnych wartości pola `{definition.Code}`.");
                }

                return new CustomFieldValue(value, null, null, null);

            case CustomFieldDataType.Number:
                if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
                {
                    throw new DomainException(
                        "taskmgmt.field_value_not_a_number",
                        $"`{value}` nie jest liczbą — pole `{definition.Code}` oczekuje liczby.");
                }

                return new CustomFieldValue(null, number, null, null);

            case CustomFieldDataType.Date:
                if (!DateTimeOffset.TryParse(
                        value,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                        out var date))
                {
                    throw new DomainException(
                        "taskmgmt.field_value_not_a_date",
                        $"`{value}` nie jest datą — pole `{definition.Code}` oczekuje daty ISO-8601.");
                }

                return new CustomFieldValue(null, null, date, null);

            case CustomFieldDataType.User:
                if (!Guid.TryParse(value, out var user))
                {
                    throw new DomainException(
                        "taskmgmt.field_value_not_a_user",
                        $"`{value}` nie jest identyfikatorem użytkownika — pole `{definition.Code}` oczekuje uuid.");
                }

                return new CustomFieldValue(null, null, null, user);

            default:
                throw new DomainException(
                    "taskmgmt.field_type_unknown",
                    $"Nieznany typ pola `{definition.Code}`.");
        }
    }

    /// <summary>Postać kanoniczna trafiająca do <c>issue.custom_fields</c> i do klienta.</summary>
    public string? ToCanonicalString() => this switch
    {
        { Text: { } text } => text,
        { Number: { } number } => number.ToString(CultureInfo.InvariantCulture),
        { Date: { } date } => date.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
        { User: { } user } => user.ToString(),
        _ => null,
    };
}
