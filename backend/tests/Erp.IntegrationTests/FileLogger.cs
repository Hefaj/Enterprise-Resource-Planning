using Microsoft.Extensions.Logging;

namespace Erp.IntegrationTests;

/// <summary>
/// Zrzuca logi węzła do pliku.
///
/// <para>Węzeł Wolverine'a zgłasza problemy z routingiem i doręczaniem <b>logiem</b>, a nie
/// wyjątkiem — brak handlera dla komunikatu albo odrzucone powiązanie kolejki kończy się cichym
/// wpisem i komunikatem w dead letters. Bez tego pliku diagnostyka takiego testu sprowadza się
/// do zgadywania, dlaczego licznik został na zerze.</para>
/// </summary>
internal sealed class FileLoggerProvider : ILoggerProvider
{
    private static readonly Lock Gate = new();

    private readonly string _path;

    public FileLoggerProvider(string path) => _path = path;

    public ILogger CreateLogger(string categoryName) => new FileLogger(_path, categoryName);

    public void Dispose()
    {
    }

    private sealed class FileLogger : ILogger
    {
        private readonly string _path;
        private readonly string _category;

        public FileLogger(string path, string category)
        {
            _path = path;
            _category = category;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Debug;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var line = $"[{logLevel}] {_category}: {formatter(state, exception)}"
                + (exception is null ? string.Empty : Environment.NewLine + exception);

            lock (Gate)
            {
                File.AppendAllText(_path, line + Environment.NewLine);
            }
        }
    }
}
