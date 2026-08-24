using System.Reflection;
using System.Text.RegularExpressions;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Shouldly;
using Xunit;

namespace Erp.ArchitectureTests;

/// <summary>
/// Egzekwuje konwencję nazewniczą z <c>docs/backend/endpoint-naming.md</c>.
///
/// <para>Konwencja zapisana wyłącznie w dokumencie przestaje obowiązywać przy pierwszej komendzie
/// pisanej pod presją czasu — to ten sam argument, dla którego granic warstw pilnuje
/// <see cref="LayeringTests"/>, a nie code review. Tu jest dokładnie ta sama wymiana: nowy
/// czasownik dodaje się przez świadomą zmianę tego pliku, a nie przez napisanie komendy, która
/// akurat przechodzi.</para>
///
/// <para><b>Zakres.</b> Skanowane są wyłącznie zestawy modułów. Fundament (<c>building-blocks</c>)
/// i sam projekt testowy są pominięte — ten drugi celowo zawiera typy wzorcowe
/// (<c>SamplePlainCommand</c>), które konwencji nie spełniają, bo służą do sprawdzania skanera
/// rejestracji, a nie nazewnictwa.</para>
/// </summary>
public class CommandNamingTests
{
    /// <summary>Pięć dopuszczalnych czasowników. Rozszerzenie tej listy jest decyzją, nie skutkiem ubocznym.</summary>
    private static readonly Regex CommandNamePattern = new(
        @"^[A-Z][A-Za-z]*?(Create|Set|Add|Remove|Exec)[A-Za-z]*Command$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Assembly[] ModuleAssemblies =
    [
        typeof(Catalog.Application.Products.ProductSetPriceCommand).Assembly,
        typeof(Identity.Application.Users.UserAddRoleCommand).Assembly,
        typeof(Sales.Application.Customers.CustomerSetNameCommand).Assembly,
        typeof(Catalog.Products.Command.ProductSetPriceMultipleCommandEndpoint).Assembly,
        typeof(Identity.Users.Command.UserAddRoleMultipleCommandEndpoint).Assembly,
        typeof(Sales.Customers.Command.CustomerSetNameMultipleCommandEndpoint).Assembly,
    ];

    private static IReadOnlyList<Type> Commands() =>
    [
        .. ModuleAssemblies
            .Distinct()
            .SelectMany(a => a.GetTypes())
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition() == typeof(ICommand<>)))
            .OrderBy(t => t.FullName, StringComparer.Ordinal),
    ];

    private static IReadOnlyList<Type> BatchEndpoints() =>
    [
        .. ModuleAssemblies
            .Distinct()
            .SelectMany(a => a.GetTypes())
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .Where(IsBatchEndpoint)
            .OrderBy(t => t.FullName, StringComparer.Ordinal),
    ];

    private static bool IsBatchEndpoint(Type type)
    {
        for (var current = type.BaseType; current is not null; current = current.BaseType)
        {
            if (current.IsGenericType
                && current.GetGenericTypeDefinition() == typeof(BatchEndpointBase<,>))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Bez tego testu zbiór czasowników rozjeżdża się w tempie jednego synonimu na moduł —
    /// stan sprzed ujednolicenia miał ich osiem (<c>Assign</c>, <c>Grant</c>, <c>Revoke</c>…),
    /// z czego połowa opisywała tę samą operację co inny.
    /// </summary>
    [Fact]
    public void Komenda_uzywa_jednego_z_pieciu_czasownikow()
    {
        var offenders = Commands()
            .Where(t => !CommandNamePattern.IsMatch(t.Name))
            .Select(t => t.FullName)
            .ToList();

        offenders.ShouldBeEmpty(
            "Nazwa komendy musi mieć postać {Agregat}{Create|Set|Add|Remove|Exec}{Cel}Command "
            + $"— patrz docs/backend/endpoint-naming.md. Niezgodne: {string.Join(", ", offenders)}");
    }

    /// <summary>
    /// Prefiks nazwy komendy musi zgadzać się z agregatem, w którego folderze komenda leży.
    /// Folder odwzorowuje się w ostatnim segmencie namespace'u (<c>Catalog.Application.Products</c>),
    /// więc <c>ProductSetPriceCommand</c> jest poprawne, a <c>SetCustomerNameCommand</c>
    /// w <c>Sales.Application.Customers</c> — nie.
    /// </summary>
    [Fact]
    public void Prefiks_komendy_zgadza_sie_z_agregatem()
    {
        var offenders = new List<string>();

        foreach (var command in Commands())
        {
            var folder = command.Namespace?.Split('.').LastOrDefault();
            if (string.IsNullOrEmpty(folder))
            {
                continue;
            }

            // Nazwa folderu jest w liczbie mnogiej, nazwa komendy — pojedynczej. Akceptujemy
            // obie formy, bo część agregatów ma tę samą postać w obu (np. `Multimedia`).
            if (!command.Name.StartsWith(Singularize(folder), StringComparison.Ordinal)
                && !command.Name.StartsWith(folder, StringComparison.Ordinal))
            {
                offenders.Add($"{command.FullName} (oczekiwany prefiks: {Singularize(folder)})");
            }
        }

        offenders.ShouldBeEmpty(
            $"Komenda musi zaczynać się od nazwy swojego agregatu. Niezgodne: {string.Join(", ", offenders)}");
    }

    /// <summary>
    /// Każda komenda ma endpoint o nazwie wyprowadzonej z jej własnej. Komenda bez endpointu jest
    /// martwym kodem; endpoint bez komendy nie istnieje (nie skompilowałby się), ale rozjazd
    /// w NAZWIE — owszem, i wtedy wygenerowana metoda klienta przestaje odpowiadać typowi,
    /// który przyjmuje.
    ///
    /// <para>Dopuszczalne są dwa sufiksy. <c>MultipleCommandEndpoint</c> to reguła — praktycznie
    /// każda komenda zapisu idzie wsadem. <c>CommandEndpoint</c> jest wyjątkiem dla operacji,
    /// które same w sobie są już zbiorcze i dla których wsad po agregacie nie ma sensu (dziś:
    /// zlecenie eksportu, patrz <c>ExportRunCreateCommandEndpoint</c>).</para>
    /// </summary>
    [Fact]
    public void Komenda_i_endpoint_maja_zgodne_nazwy()
    {
        var endpointNames = ModuleAssemblies
            .Distinct()
            .SelectMany(a => a.GetTypes())
            .Where(t => t is { IsClass: true, IsAbstract: false } && t.Name.EndsWith("Endpoint", StringComparison.Ordinal))
            .Select(t => t.Name)
            .ToHashSet(StringComparer.Ordinal);

        var offenders = Commands()
            .Select(c => new
            {
                Command = c,
                Stem = c.Name[..^"Command".Length],
            })
            .Where(x => !endpointNames.Contains(x.Stem + "MultipleCommandEndpoint")
                     && !endpointNames.Contains(x.Stem + "CommandEndpoint"))
            .Select(x => $"{x.Command.FullName} → brakuje {x.Stem}MultipleCommandEndpoint")
            .ToList();

        offenders.ShouldBeEmpty(
            "Endpoint musi nazywać się {NazwaKomendy bez sufiksu Command}MultipleCommandEndpoint "
            + $"(albo CommandEndpoint dla operacji bez wsadu). Niezgodne: {string.Join(", ", offenders)}");
    }

    /// <summary>
    /// Trasa nie powtarza nazwy swojej grupy — prefiks dokłada <c>Group&lt;XGroup&gt;()</c>.
    /// Powtórzenie dawało ścieżki w rodzaju <c>/product/product/batch-set-price</c>, które
    /// kompilują się i działają, więc nic ich nie łapało poza czytaniem wygenerowanego klienta.
    ///
    /// <para>Sprawdzenie idzie po źródłach, a nie po refleksji: trasa ustawiana jest wewnątrz
    /// <c>Configure()</c>, a wywołanie jej wymagałoby zbudowania endpointu razem z całym jego DI.
    /// Gdy źródeł nie ma (pakiet bez repo), test się pomija zamiast fałszywie przechodzić.</para>
    /// </summary>
    [Fact]
    public void Trasa_nie_powtarza_nazwy_grupy()
    {
        var repoRoot = FindRepositoryRoot();
        Assert.SkipWhen(repoRoot is null, "Nie znaleziono katalogu źródeł — pomijam kontrolę tras.");

        var endpointFiles = Directory.GetFiles(
            Path.Combine(repoRoot!, "backend", "modules"),
            "*MultipleCommandEndpoint.cs",
            SearchOption.AllDirectories);

        endpointFiles.ShouldNotBeEmpty("Nie znaleziono żadnego endpointu wsadowego — ścieżka się rozjechała.");

        var offenders = new List<string>();

        foreach (var file in endpointFiles)
        {
            var source = File.ReadAllText(file);

            var route = Regex.Match(source, @"Post\(""(?<route>[^""]+)""\)").Groups["route"].Value;
            var group = Regex.Match(source, @"Group<(?<group>\w+)Group>\(\)").Groups["group"].Value;

            if (string.IsNullOrEmpty(route) || string.IsNullOrEmpty(group))
            {
                continue;
            }

            var prefix = group[..1].ToLowerInvariant() + group[1..];
            if (route.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase))
            {
                offenders.Add($"{Path.GetFileName(file)}: Post(\"{route}\") razem z Group<{group}Group>()");
            }
        }

        offenders.ShouldBeEmpty(
            "Trasa nie może powtarzać prefiksu swojej grupy — patrz docs/backend/endpoint-naming.md §7. "
            + $"Niezgodne: {string.Join("; ", offenders)}");
    }

    private static string Singularize(string plural)
    {
        if (plural.EndsWith("ies", StringComparison.Ordinal))
        {
            return plural[..^3] + "y";
        }

        return plural.EndsWith('s') ? plural[..^1] : plural;
    }

    private static string? FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            if (directory.GetFiles("*.sln").Length > 0)
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        return null;
    }
}
