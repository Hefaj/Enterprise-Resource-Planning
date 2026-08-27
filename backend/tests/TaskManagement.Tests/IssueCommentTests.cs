using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Issues;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Reguły wątku komentarzy. Testujemy agregat, a nie handler — to on jest miejscem, w którym
/// te reguły obowiązują niezależnie od tego, którym endpointem przyszło żądanie.
/// </summary>
public class IssueCommentTests
{
    private static readonly Guid IssueUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Author = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Other = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);

    private static IssueComment Root(string body = "<p>treść</p>")
        => IssueComment.Create(Guid.CreateVersion7(), IssueUuid, body, Author, Now);

    [Fact]
    public void Odpowiedz_na_odpowiedz_jest_odrzucana()
    {
        var root = Root();
        var reply = IssueComment.ReplyTo(Guid.CreateVersion7(), root, "<p>odpowiedź</p>", Other, Now);

        var error = Should.Throw<DomainException>(
            () => IssueComment.ReplyTo(Guid.CreateVersion7(), reply, "<p>głębiej</p>", Author, Now));

        error.ErrorCode.ShouldBe("taskmgmt.comment_thread_too_deep");
    }

    [Fact]
    public void Odpowiedz_dziedziczy_zgloszenie_po_rodzicu()
    {
        var reply = IssueComment.ReplyTo(Guid.CreateVersion7(), Root(), "<p>odpowiedź</p>", Other, Now);

        reply.IssueUuid.ShouldBe(IssueUuid);
        reply.ParentUuid.ShouldNotBeNull();
    }

    [Fact]
    public void Edycja_przez_kogos_innego_niz_autor_jest_odrzucana()
    {
        var comment = Root();

        var error = Should.Throw<DomainException>(() => comment.SetBody("<p>podmiana</p>", Other, Now));

        error.ErrorCode.ShouldBe("taskmgmt.comment_not_author");
        comment.Body.ShouldBe("<p>treść</p>");
    }

    [Fact]
    public void Pierwsza_edycja_utrwala_oryginal_a_kolejne_go_nie_ruszaja()
    {
        var comment = Root();

        comment.SetBody("<p>druga wersja</p>", Author, Now);
        comment.SetBody("<p>trzecia wersja</p>", Author, Now.AddMinutes(1));

        comment.OriginalBody.ShouldBe("<p>treść</p>");
        comment.Body.ShouldBe("<p>trzecia wersja</p>");
        comment.EditedAt.ShouldBe(Now.AddMinutes(1));
    }

    [Fact]
    public void Zapis_tej_samej_tresci_nie_jest_edycja()
    {
        var comment = Root();

        comment.SetBody("<p>treść</p>", Author, Now.AddMinutes(5));

        comment.EditedAt.ShouldBeNull();
        comment.OriginalBody.ShouldBeNull();
    }

    [Fact]
    public void Usuniety_komentarz_traci_tresc_ale_zostaje_wierszem()
    {
        var comment = Root();

        comment.Remove(Now);

        comment.IsRemoved.ShouldBeTrue();
        comment.Body.ShouldBeEmpty();
        comment.OriginalBody.ShouldBe("<p>treść</p>");
    }

    [Fact]
    public void Usuniety_komentarz_nie_przyjmuje_edycji_ani_odpowiedzi()
    {
        var comment = Root();
        comment.Remove(Now);

        Should.Throw<DomainException>(() => comment.SetBody("<p>wracam</p>", Author, Now)).ErrorCode
            .ShouldBe("taskmgmt.comment_removed");

        Should.Throw<DomainException>(
                () => IssueComment.ReplyTo(Guid.CreateVersion7(), comment, "<p>halo</p>", Other, Now))
            .ErrorCode.ShouldBe("taskmgmt.comment_removed");
    }

    [Fact]
    public void Pusta_tresc_jest_odrzucana()
    {
        Should.Throw<DomainException>(
                () => IssueComment.Create(Guid.CreateVersion7(), IssueUuid, "   ", Author, Now))
            .ErrorCode.ShouldBe("taskmgmt.comment_body_empty");
    }
}

/// <summary>Historia zgłoszenia — przycinanie wartości i wymagana przynależność do zgłoszenia.</summary>
public class IssueActivityTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Dluga_wartosc_jest_przycinana_do_limitu()
    {
        var activity = IssueActivity.Record(
            Guid.CreateVersion7(),
            IssueActivityKind.FieldChanged,
            "title",
            new string('x', IssueActivity.MaxValueLength + 100),
            "nowy",
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Now);

        activity.OldValue!.Length.ShouldBe(IssueActivity.MaxValueLength);
    }

    [Fact]
    public void Pusta_wartosc_zapisuje_sie_jako_brak()
    {
        var activity = IssueActivity.Record(
            Guid.CreateVersion7(),
            IssueActivityKind.FieldChanged,
            "assignee",
            "   ",
            null,
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Now);

        activity.OldValue.ShouldBeNull();
        activity.NewValue.ShouldBeNull();
    }

    [Fact]
    public void Wpis_bez_zgloszenia_jest_odrzucany()
    {
        Should.Throw<DomainException>(() => IssueActivity.Record(
                Guid.Empty,
                IssueActivityKind.Created,
                null,
                null,
                null,
                Guid.CreateVersion7(),
                Guid.CreateVersion7(),
                Now))
            .ErrorCode.ShouldBe("taskmgmt.activity_issue_empty");
    }
}
