using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Boards;

/// <summary>
/// Karta na tablicy — <b>kolejność zgłoszenia na konkretnej tablicy</b>
/// (<c>docs/backend/task-management.md</c> §7.1).
///
/// <para>Kolejność należy do tablicy, nie do zgłoszenia: to samo zgłoszenie może wisieć wysoko
/// na tablicy działu dev i nisko na tablicy zarządu. Dlatego rank mieszka tutaj, a nie na
/// <c>Issue</c>.</para>
///
/// <para><b>Dlaczego karta jest korzeniem agregatu, skoro kluczem naturalnym jest para
/// (tablica, zgłoszenie).</b> Bo <c>AggregateChanged</c> powstaje ze skanu ChangeTrackera
/// i niesie uuid <i>korzenia</i>. Gdyby karta była dzieckiem tablicy, każde przeciągnięcie
/// rozgłaszałoby uuid tablicy, czyli kazałoby wszystkim klientom przeładować kilkaset kart —
/// dokładnie to, czego §7.4 zakazuje. Niezmiennik „jedno zgłoszenie ma najwyżej jedną kartę
/// na danej tablicy” egzekwuje unikalny indeks bazy, jak wszystkie trzy niezmienniki
/// międzyagregatowe tego modułu (§3).</para>
/// </summary>
public sealed class BoardCard : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private BoardCard()
    {
    }

    private BoardCard(Guid uuid, Guid boardUuid, Guid issueUuid, string rank, DateTimeOffset now)
        : base(uuid)
    {
        BoardUuid = boardUuid;
        IssueUuid = issueUuid;
        Rank = rank;
        UpdatedAt = now;
    }

    public Guid BoardUuid { get; private set; }

    public Guid IssueUuid { get; private set; }

    /// <summary>Pozycja jako łańcuch porządkowany leksykograficznie — patrz
    /// <see cref="BoardRank"/>. Porządek rozstrzyga para <c>(rank, uuid)</c>, nigdy sam rank:
    /// dwie osoby wstawiające kartę w to samo miejsce wyliczą <b>identyczny</b> rank i to nie
    /// jest błąd (§7.3).</summary>
    public string Rank { get; private set; } = string.Empty;

    /// <summary>Sprint, do którego karta należy na tablicy scrumowej. Puste do fazy 6.</summary>
    public Guid? SprintUuid { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// Zakłada kartę o wyliczonym już ranku.
    ///
    /// <para>Rank przychodzi z zewnątrz, bo karty powstają <b>zbiorczo</b>: pierwsze
    /// przestawienie na tablicy nadaje ranki wszystkim jej zgłoszeniom naraz, równomiernie
    /// rozłożone (<see cref="BoardRank.Sequence"/>). Liczenie go tutaj, po jednej karcie,
    /// dawałoby łańcuchy rosnące z każdą kolejną kartą — czyli tablicę kwalifikującą się
    /// do rebalansu w dniu założenia.</para>
    /// </summary>
    public static BoardCard CreateWithUuid(
        Guid uuid,
        Guid boardUuid,
        Guid issueUuid,
        string rank,
        DateTimeOffset now)
    {
        if (boardUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.board_card_board_empty", "Karta musi należeć do tablicy.");
        }

        if (issueUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.board_card_issue_empty", "Karta musi wskazywać zgłoszenie.");
        }

        if (string.IsNullOrWhiteSpace(rank))
        {
            throw new DomainException("taskmgmt.board_rank_empty", "Rank karty nie może być pusty.");
        }

        return new BoardCard(uuid, boardUuid, issueUuid, rank, now);
    }

    /// <summary>
    /// Przestawia kartę pomiędzy sąsiadów. Ranki sąsiadów przychodzą <b>z bazy, w transakcji</b>,
    /// nie z żądania klienta — komenda niesie identyfikatory sąsiadów, a nie wyliczony rank
    /// (§7.2). Gdyby rank liczył klient, każde przestawienie na nieaktualnym widoku wstawiałoby
    /// kartę w miejsce, którego użytkownik nie widział.
    /// </summary>
    public void SetPosition(string? previousRank, string? nextRank, DateTimeOffset now)
    {
        var rank = BoardRank.Between(previousRank, nextRank);

        if (string.Equals(rank, Rank, StringComparison.Ordinal))
        {
            return;
        }

        Rank = rank;
        UpdatedAt = now;
    }

    /// <summary>Nadaje rank wyliczony przez rebalans tablicy. Osobno od
    /// <see cref="SetPosition"/>, bo tu nie ma sąsiadów do wyszukania — cała tablica dostaje
    /// nowe, równomiernie rozłożone ranki naraz (§7.2).</summary>
    public void Rebalance(string rank, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(rank))
        {
            throw new DomainException("taskmgmt.board_rank_empty", "Rank karty nie może być pusty.");
        }

        if (string.Equals(rank, Rank, StringComparison.Ordinal))
        {
            return;
        }

        Rank = rank;
        UpdatedAt = now;
    }

    public void SetSprint(Guid? sprintUuid, DateTimeOffset now)
    {
        SprintUuid = sprintUuid == Guid.Empty ? null : sprintUuid;
        UpdatedAt = now;
    }
}
