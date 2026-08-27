using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskManagement.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Migracja <b>bez DDL i to jest poprawne</b>: zmiana dotyczy wyłącznie modelu EF
    /// (<c>ValueGeneratedNever</c> na kluczach dzieci agregatów), a kolumny <c>uuid</c> i tak
    /// nigdy nie miały wartości domyślnej po stronie Postgresa. Migracja istnieje po to, żeby
    /// migawka modelu zgadzała się z konfiguracją — bez niej następna migracja niosłaby tę
    /// różnicę razem ze swoją własną zmianą.
    ///
    /// <para>Powód zmiany: klucz dziecka nadaje agregat, a nie baza. Przy
    /// <c>ValueGeneratedOnAdd</c> EF traktował dziecko dołożone do już śledzonego rodzica jako
    /// encję istniejącą i wysyłał <c>UPDATE</c> zamiast <c>INSERT</c> — trafiał w zero wierszy
    /// i kończył się konfliktem współbieżności, przez co komenda dodania pola nigdy się nie
    /// zapisywała.</para>
    /// </summary>
    public partial class ClientAssignedChildKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
