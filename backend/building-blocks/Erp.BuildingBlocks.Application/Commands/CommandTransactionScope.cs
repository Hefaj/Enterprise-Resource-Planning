namespace Erp.BuildingBlocks.Application.Commands;

/// <summary>
/// Rozstrzyga jedno pytanie: <b>kto zatwierdza transakcję</b> dla komendy przechodzącej
/// przez pipeline. Stan jest per scope DI, czyli per żądanie HTTP albo per chunk zadania.
///
/// <para><b>Dlaczego to nie jest po prostu „commit po każdej komendzie".</b> Dwa miejsca
/// w systemie świadomie wykonują wiele komend w JEDNEJ transakcji i oba mają na to konkretny
/// powód: <c>MultimediaCreateCommandEndpoint</c> rejestruje paczkę wgranych plików na zasadzie
/// wszystko-albo-nic (katalog z połową galerii jest gorszy niż odrzucenie całości),
/// a <c>BulkCommandRunner</c> traktuje cały chunk jako jeden commit — na tym stoi wznawianie
/// zadania po restarcie i liczniki, które nie rozjeżdżają się ze stanem danych. Gdyby jednostka
/// pracy zatwierdzała po każdej komendzie, oba te mechanizmy przestałyby działać po cichu:
/// nic by nie wybuchło, po prostu granica transakcji przesunęłaby się o rząd wielkości.</para>
///
/// <para><b>Zagnieżdżenie</b> liczone jest osobno od przejęcia. Komenda wywołana z wnętrza innej
/// komendy nie zatwierdza niczego — właścicielem jest wywołanie najbardziej zewnętrzne.</para>
/// </summary>
public sealed class CommandTransactionScope
{
    private int _depth;
    private bool _claimed;

    /// <summary>
    /// Przejmuje granicę transakcji: dopóki zwrócony token żyje, żadna komenda nie zatwierdzi
    /// zmian sama — robi to wywołujący, wtedy kiedy uzna paczkę za kompletną.
    /// </summary>
    public IDisposable Claim()
    {
        var previous = _claimed;
        _claimed = true;
        return new ClaimToken(this, previous);
    }

    /// <summary>
    /// Wchodzi w wywołanie komendy. Zwrócony token mówi, czy TO wywołanie odpowiada za commit.
    /// </summary>
    public Boundary Enter()
    {
        _depth++;
        return new Boundary(this, ownsCommit: _depth == 1 && !_claimed);
    }

    private void Exit() => _depth--;

    /// <summary>Token jednego wywołania komendy; zwalnia zagnieżdżenie przy <see cref="Dispose"/>.</summary>
    public readonly struct Boundary : IDisposable, IEquatable<Boundary>
    {
        private readonly CommandTransactionScope _scope;

        internal Boundary(CommandTransactionScope scope, bool ownsCommit)
        {
            _scope = scope;
            OwnsCommit = ownsCommit;
        }

        /// <summary>Czy to wywołanie ma zatwierdzić jednostkę pracy.</summary>
        public bool OwnsCommit { get; }

        /// <inheritdoc />
        public void Dispose() => _scope?.Exit();

        /// <inheritdoc />
        public bool Equals(Boundary other) => ReferenceEquals(_scope, other._scope) && OwnsCommit == other.OwnsCommit;

        /// <inheritdoc />
        public override bool Equals(object? obj) => obj is Boundary other && Equals(other);

        /// <inheritdoc />
        public override int GetHashCode() => HashCode.Combine(_scope, OwnsCommit);

        public static bool operator ==(Boundary left, Boundary right) => left.Equals(right);

        public static bool operator !=(Boundary left, Boundary right) => !left.Equals(right);
    }

    private sealed class ClaimToken : IDisposable
    {
        private readonly CommandTransactionScope _scope;
        private readonly bool _previous;
        private bool _disposed;

        internal ClaimToken(CommandTransactionScope scope, bool previous)
        {
            _scope = scope;
            _previous = previous;
        }

        public void Dispose()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            _scope._claimed = _previous;
        }
    }
}
