using System.Globalization;
using System.Text;
using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Boards;

/// <summary>
/// Indeksowanie ułamkowe kolejności kart — <b>łańcuch porządkowany leksykograficznie</b>,
/// nie liczba całkowita (<c>docs/modules/task-management/domain.md</c> §7.2).
///
/// <para>Pozycja jako <c>int</c> z przenumerowaniem wymaga przy każdym przeciągnięciu karty
/// <c>UPDATE</c> na kilkudziesięciu wierszach — długa transakcja, kolizja z drugą osobą
/// przestawiającą karty i burza zdarzeń realtime. Tutaj przestawienie karty to
/// <b>jeden <c>UPDATE</c> jednego wiersza</b>, bo między dowolne dwa łańcuchy da się wstawić
/// trzeci (między <c>"n"</c> a <c>"o"</c> wchodzi <c>"nn"</c>).</para>
///
/// <para><b>Niezmiennik: żaden wygenerowany rank nie kończy się najmniejszym znakiem
/// alfabetu.</b> Gdyby się kończył, przed nim nie dałoby się już niczego wstawić
/// (między <c>"0"</c> a <c>"00"</c> nie ma nic) — a to jedyny przypadek, w którym ten schemat
/// przestaje działać. Cała reszta klasy jest zwykłym wyszukiwaniem środka.</para>
/// </summary>
public static class BoardRank
{
    /// <summary>Alfabet base-36: cyfry i małe litery. Uporządkowany tak samo w Postgresie
    /// przy zestawieniu <c>C</c> i w porównaniu ordinalnym w .NET — a to jest warunek konieczny,
    /// żeby serwer i przeglądarka układały karty w tej samej kolejności.</summary>
    private const string Alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

    private const int Radix = 36;

    /// <summary>Środek alfabetu — pierwszy rank na pustej tablicy i wypełniacz przy schodzeniu
    /// o poziom niżej.</summary>
    private const char MidChar = 'i';

    /// <summary>
    /// Próg długości, po którym rebalans tablicy ma sens.
    ///
    /// <para>Łańcuchy rosną wyłącznie przy wielokrotnym wstawianiu <b>w to samo miejsce</b> —
    /// każde takie wstawienie dokłada najwyżej jeden znak. 24 znaki to więc dwadzieścia kilka
    /// przeciągnięć pod rząd w tę samą szczelinę: realne przy porządkowaniu backlogu, ale nie
    /// przy zwykłej pracy. Próg jest po to, żeby rebalans był rzadkim zdarzeniem, a nie
    /// codziennym przepisywaniem tablicy.</para>
    /// </summary>
    public const int RebalanceLengthThreshold = 24;

    /// <summary>
    /// Rank ściśle pomiędzy sąsiadami. <paramref name="previous"/> puste oznacza początek
    /// listy, <paramref name="next"/> puste — koniec.
    /// </summary>
    /// <exception cref="DomainException">Sąsiedzi podani w złej kolejności albo identyczni —
    /// to znaczy, że wywołujący źle odczytał, gdzie użytkownik upuścił kartę, i wynik byłby
    /// kolejnością, której nikt nie widział.</exception>
    public static string Between(string? previous, string? next)
    {
        var lower = previous ?? string.Empty;
        var upper = string.IsNullOrEmpty(next) ? null : next;

        if (upper is not null && string.CompareOrdinal(lower, upper) >= 0)
        {
            throw new DomainException(
                "taskmgmt.board_rank_invalid_bounds",
                $"Sąsiedzi karty muszą być podani rosnąco — dostałem `{lower}` i `{upper}`.");
        }

        var result = new StringBuilder();

        for (var i = 0; ; i++)
        {
            // -1 = „poniżej najmniejszego znaku”: dolna granica się skończyła, więc każde
            // przedłużenie jest od niej większe. Radix = „powyżej największego”: górnej granicy
            // nie ma (koniec listy).
            var low = i < lower.Length ? IndexOf(lower[i]) : -1;
            var high = upper is null || i >= upper.Length ? Radix : IndexOf(upper[i]);

            if (high - low > 1)
            {
                var mid = (low + high) / 2;

                if (mid > 0)
                {
                    return result.Append(Alphabet[mid]).ToString();
                }

                // mid == 0 znaczy, że środek wypadł na najmniejszy znak — zejście o poziom
                // niżej zamiast złamania niezmiennika o końcówce. Skoro `mid == 0`, to dolna
                // granica jest już wyczerpana, a górna ma tu znak większy od zera: wynik jest
                // od niej mniejszy niezależnie od tego, co dopiszemy dalej.
                return result.Append(Alphabet[0]).Append(MidChar).ToString();
            }

            // Brak miejsca na tym poziomie — przepisujemy znak dolnej granicy i schodzimy niżej.
            result.Append(i < lower.Length ? lower[i] : Alphabet[0]);
        }
    }

    /// <summary>
    /// <paramref name="count"/> równomiernie rozłożonych ranków — dla rebalansu tablicy
    /// i dla pierwszego zapełnienia kolumny.
    ///
    /// <para>Równomiernie, a nie „jeden za drugim”: po rebalansie użytkownik dalej przestawia
    /// karty, a szczeliny między rankami są dokładnie tym, co pozwala mu to robić bez kolejnego
    /// przenumerowania.</para>
    /// </summary>
    public static IReadOnlyList<string> Sequence(int count)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(count);

        if (count == 0)
        {
            return [];
        }

        // Szerokość dobrana tak, żeby na każdą kartę wypadła co najmniej jedna wolna szczelina.
        var width = 1;
        var slots = (long)Radix;
        while (slots < (long)(count + 1) * 2 && width < 8)
        {
            width++;
            slots *= Radix;
        }

        var step = slots / (count + 1);
        var ranks = new List<string>(count);

        for (var i = 1; i <= count; i++)
        {
            var value = step * i;

            // Niezmiennik końcówki: rank kończący się najmniejszym znakiem zablokowałby
            // wstawianie przed sobą, więc przesuwamy go o jedną pozycję w górę.
            if (value % Radix == 0)
            {
                value++;
            }

            ranks.Add(Encode(value, width));
        }

        return ranks;
    }

    /// <summary>Czy tablica z takim najdłuższym rankiem kwalifikuje się do rebalansu.</summary>
    public static bool NeedsRebalance(int longestRankLength) => longestRankLength > RebalanceLengthThreshold;

    private static int IndexOf(char c)
    {
        var index = Alphabet.IndexOf(c, StringComparison.Ordinal);

        if (index < 0)
        {
            throw new DomainException(
                "taskmgmt.board_rank_invalid_character",
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Rank może zawierać wyłącznie cyfry i małe litery — znalazłem `{c}`."));
        }

        return index;
    }

    private static string Encode(long value, int width)
    {
        var digits = new char[width];

        for (var i = width - 1; i >= 0; i--)
        {
            digits[i] = Alphabet[(int)(value % Radix)];
            value /= Radix;
        }

        return new string(digits);
    }
}
