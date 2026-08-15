namespace Catalog.Domain.Attributes;

/// <summary>
/// Tłumaczenie enumów atrybutu na wartości kontraktu HTTP.
///
/// <para>W kontrakcie stringi, w domenie i w bazie enumy — dokładnie tak samo jak przy
/// <c>ProductStatus</c>. Stałe zamiast <c>ToString()</c>, bo nazwa pozycji w C# jest wtedy
/// wolna do zmiany, a wartość widziana przez frontend nie.</para>
/// </summary>
public static class AttributeNames
{
    public const string KindDictionary = "Dictionary";

    public const string KindValue = "Value";

    public const string KindMultimedia = "Multimedia";

    public const string DataTypeNone = "None";

    public const string DataTypeText = "Text";

    public const string DataTypeNumber = "Number";

    public const string DataTypeBoolean = "Boolean";

    public const string DataTypeDate = "Date";

    /// <summary>Zamienia rodzaj atrybutu na wartość kontraktu.</summary>
    public static string ToContract(this AttributeKind kind) => kind switch
    {
        AttributeKind.Dictionary => KindDictionary,
        AttributeKind.Multimedia => KindMultimedia,
        _ => KindValue,
    };

    /// <summary>Zamienia typ danych atrybutu na wartość kontraktu.</summary>
    public static string ToContract(this AttributeDataType dataType) => dataType switch
    {
        AttributeDataType.Text => DataTypeText,
        AttributeDataType.Number => DataTypeNumber,
        AttributeDataType.Boolean => DataTypeBoolean,
        AttributeDataType.Date => DataTypeDate,
        _ => DataTypeNone,
    };
}
