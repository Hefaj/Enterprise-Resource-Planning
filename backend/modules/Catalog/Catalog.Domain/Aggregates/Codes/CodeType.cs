using System.Text.RegularExpressions;
using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Codes;

/// <summary>
/// Typ kodu produktu — pozycja słownika (EAN, SKU, MPN, kod dostawcy…).
///
/// <para><b>Dlaczego osobny agregat, a nie enum.</b> Lista typów kodów jest danymi, nie kodem:
/// nowy kanał sprzedaży albo nowy dostawca przynosi własny typ identyfikatora, a dodanie go
/// nie może wymagać migracji i wdrożenia. Enum wymuszałby jedno i drugie.</para>
///
/// <para><b>Granica agregatu.</b> Typ nie zna produktów, które się nim posługują — produkt
/// trzyma wyłącznie <c>CodeTypeUuid</c>. Dzięki temu wczytanie słownika nie wciąga katalogu,
/// a zmiana nazwy typu nie dotyka ani jednego wiersza <c>product_code</c>.</para>
/// </summary>
public class CodeType : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected CodeType()
    {
    }

    private CodeType(Guid uuid, string symbol, string name, string? pattern, bool isUnique, int sortOrder)
        : base(uuid)
    {
        Symbol = symbol;
        Name = name;
        Pattern = pattern;
        IsUnique = isUnique;
        SortOrder = sortOrder;
    }

    /// <summary>Symbol techniczny, unikalny w słowniku (<c>EAN</c>, <c>SKU</c>). To po nim
    /// integracje rozpoznają typ — nazwa jest tylko etykietą dla użytkownika i wolno ją zmieniać.</summary>
    public string Symbol { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Wyrażenie regularne, któremu musi odpowiadać wartość kodu; <c>null</c> = bez ograniczeń.
    ///
    /// <para>Sprawdzane przy nadawaniu kodu produktowi (<see cref="Validate"/>), nie przy
    /// zapisie słownika — zmiana maski nie unieważnia wstecz kodów już nadanych.</para>
    /// </summary>
    public string? Pattern { get; private set; }

    /// <summary>
    /// Czy wartość tego typu musi być unikalna w całym katalogu.
    ///
    /// <para>Włączone dla identyfikatorów handlowych (SKU, EAN), wyłączone dla kodów, które
    /// z natury się powtarzają (np. kod producenta wspólny dla wariantów). Flaga steruje tym,
    /// czy <c>ProductCode</c> wyliczy sobie <c>UniqueKey</c> — a to on wchodzi do częściowego
    /// indeksu unikalnego, który jest jedyną faktyczną gwarancją.</para>
    /// </summary>
    public bool IsUnique { get; private set; }

    /// <summary>Kolejność prezentacji w słowniku.</summary>
    public int SortOrder { get; private set; }

    public static CodeType Create(string symbol, string name, string? pattern, bool isUnique, int sortOrder)
        => new(NewUuid(), ValidateSymbol(symbol), ValidateName(name), ValidatePattern(pattern), isUnique, sortOrder);

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static CodeType CreateWithUuid(
        Guid uuid, string symbol, string name, string? pattern, bool isUnique, int sortOrder)
        => new(uuid, ValidateSymbol(symbol), ValidateName(name), ValidatePattern(pattern), isUnique, sortOrder);

    public void Rename(string name)
    {
        var validated = ValidateName(name);
        if (string.Equals(Name, validated, StringComparison.Ordinal))
        {
            return;
        }

        Name = validated;
    }

    /// <summary>Zmienia maskę wartości. Kody nadane wcześniej nie są przeliczane —
    /// patrz uwaga przy <see cref="Pattern"/>.</summary>
    public void SetPattern(string? pattern) => Pattern = ValidatePattern(pattern);

    /// <summary>
    /// Sprawdza wartość kodu wobec tego typu i zwraca ją w postaci znormalizowanej.
    ///
    /// <para>Normalizacja (przycięcie białych znaków) jest częścią reguły unikalności:
    /// <c>"590123"</c> i <c>" 590123 "</c> muszą kolidować, a nie wylądować w indeksie
    /// jako dwie różne wartości.</para>
    /// </summary>
    public string Validate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException("product_code_value_empty", "Wartość kodu nie może być pusta.");
        }

        var normalized = value.Trim();

        if (Pattern is not null && !Regex.IsMatch(normalized, Pattern, RegexOptions.None, TimeSpan.FromSeconds(1)))
        {
            throw new DomainException(
                "product_code_value_invalid",
                $"Wartość „{normalized}” nie odpowiada masce typu kodu {Symbol}.");
        }

        return normalized;
    }

    private static string ValidateSymbol(string symbol)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            throw new DomainException("code_type_symbol_empty", "Symbol typu kodu nie może być pusty.");
        }

        return symbol.Trim().ToUpperInvariant();
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("code_type_name_empty", "Nazwa typu kodu nie może być pusta.");
        }

        return name.Trim();
    }

    /// <summary>
    /// Odrzuca maskę, której nie da się skompilować. Bez tego błędne wyrażenie przeszłoby zapis
    /// słownika i wybuchłoby dopiero przy nadawaniu kodu — czyli w zupełnie innym miejscu
    /// niż popełniono błąd.
    /// </summary>
    private static string? ValidatePattern(string? pattern)
    {
        if (string.IsNullOrWhiteSpace(pattern))
        {
            return null;
        }

        try
        {
            _ = Regex.Match(string.Empty, pattern, RegexOptions.None, TimeSpan.FromSeconds(1));
        }
        catch (ArgumentException)
        {
            throw new DomainException("code_type_pattern_invalid", "Maska typu kodu nie jest poprawnym wyrażeniem regularnym.");
        }

        return pattern;
    }
}
