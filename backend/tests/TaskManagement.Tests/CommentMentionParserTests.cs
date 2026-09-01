using Shouldly;
using TaskManagement.Application.Issues;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Parsowanie wzmianek `@` z treści komentarza (NTF-002, ISS-009).</summary>
public class CommentMentionParserTests
{
    [Fact]
    public void Pusta_tresc_nie_ma_wzmianek()
        => CommentMentionParser.ExtractMentionedUsers(string.Empty).ShouldBeEmpty();

    [Fact]
    public void Tresc_bez_wzmianek_zwraca_pusta_liste()
        => CommentMentionParser.ExtractMentionedUsers("<p>zwykły komentarz</p>").ShouldBeEmpty();

    [Fact]
    public void Wzmianka_w_podwojnym_cudzyslowie_jest_wykrywana()
    {
        var uuid = Guid.CreateVersion7();
        var body = $"""<p>cc <span data-mention-user-uuid="{uuid}">@Jan</span></p>""";

        CommentMentionParser.ExtractMentionedUsers(body).ShouldBe([uuid]);
    }

    [Fact]
    public void Wzmianka_w_pojedynczym_cudzyslowie_jest_wykrywana()
    {
        var uuid = Guid.CreateVersion7();
        var body = $"<p><span data-mention-user-uuid='{uuid}'>@Jan</span></p>";

        CommentMentionParser.ExtractMentionedUsers(body).ShouldBe([uuid]);
    }

    [Fact]
    public void Wielokrotna_wzmianka_tej_samej_osoby_zwraca_jeden_wpis()
    {
        var uuid = Guid.CreateVersion7();
        var body = $"""
            <p><span data-mention-user-uuid="{uuid}">@Jan</span>
            i jeszcze raz <span data-mention-user-uuid="{uuid}">@Jan</span></p>
            """;

        CommentMentionParser.ExtractMentionedUsers(body).ShouldBe([uuid]);
    }

    [Fact]
    public void Kilka_roznych_wzmianek_zwraca_wszystkie()
    {
        var first = Guid.CreateVersion7();
        var second = Guid.CreateVersion7();
        var body = $"""
            <p><span data-mention-user-uuid="{first}">@Jan</span>
            <span data-mention-user-uuid="{second}">@Ola</span></p>
            """;

        CommentMentionParser.ExtractMentionedUsers(body).ShouldBe([first, second], ignoreOrder: true);
    }
}
