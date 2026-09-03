using Shouldly;
using TaskManagement.Application.Issues;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>SRCH-005 — gramatyka DSL wyszukiwania. Wyłącznie parsowanie na listę par
/// <c>pole: wartość</c>; rozwiązywanie na <see cref="TaskManagement.Application.Issues.SearchIssueRequest"/>
/// (wymaga bazy) jest sprawdzane osobno, w <c>Erp.IntegrationTests</c>.</summary>
public class IssueSearchDslParserTests
{
    [Fact]
    public void Parsuje_przyklad_z_wymagan()
    {
        var pairs = IssueSearchDslParser.Parse("project: ERP state: Open assignee: me");

        pairs.Count.ShouldBe(3);
        pairs[0].ShouldBe(new IssueSearchDslPair("project", "ERP", 0));
        pairs[1].ShouldBe(new IssueSearchDslPair("state", "Open", 13));
        pairs[2].ShouldBe(new IssueSearchDslPair("assignee", "me", 25));
    }

    [Fact]
    public void Pusty_tekst_daje_pusta_liste()
        => IssueSearchDslParser.Parse("   ").ShouldBeEmpty();

    [Fact]
    public void Cudzyslow_niesie_wartosc_z_odstepem()
    {
        var pairs = IssueSearchDslParser.Parse("""text: "logowanie nie działa" """);

        pairs.Count.ShouldBe(1);
        pairs[0].Field.ShouldBe("text");
        pairs[0].Value.ShouldBe("logowanie nie działa");
    }

    [Fact]
    public void Wielokrotne_tag_akumuluja_sie()
    {
        var pairs = IssueSearchDslParser.Parse("tag: backend tag: pilne");

        pairs.Count.ShouldBe(2);
        pairs[0].Value.ShouldBe("backend");
        pairs[1].Value.ShouldBe("pilne");
    }

    [Fact]
    public void Powtorzone_pole_inne_niz_tag_jest_bledem()
    {
        var exception = Should.Throw<IssueSearchDslParseException>(
            () => IssueSearchDslParser.Parse("project: ERP project: DEV"));

        exception.Message.ShouldContain("project");
        exception.Position.ShouldBe(13); // pozycja drugiego wystąpienia `project`
    }

    [Fact]
    public void Brak_dwukropka_jest_bledem_z_pozycja()
    {
        var exception = Should.Throw<IssueSearchDslParseException>(
            () => IssueSearchDslParser.Parse("project ERP"));

        exception.Position.ShouldBe(8); // token `ERP`, tam gdzie parser oczekiwał `:`
    }

    [Fact]
    public void Brak_wartosci_po_dwukropku_jest_bledem()
    {
        var exception = Should.Throw<IssueSearchDslParseException>(
            () => IssueSearchDslParser.Parse("project:"));

        exception.Position.ShouldBe(7); // pozycja ostatniego tokenu (`:`), zapytanie się skończyło
    }

    [Fact]
    public void Niezamkniety_cudzyslow_jest_bledem()
    {
        var exception = Should.Throw<IssueSearchDslParseException>(
            () => IssueSearchDslParser.Parse("""text: "brak końca"""));

        exception.Message.ShouldContain("cudzysłów");
    }
}
