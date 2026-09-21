using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Serilog.Core;
using Serilog.Events;

namespace Infrastructure.Bootstrap;

/// <summary>Best-effort Serilog sink for Loki's HTTP push API.</summary>
/// <remarks>Logging transport failure is swallowed so an unavailable Loki cannot stop the API.</remarks>
public sealed class LokiHttpSink : ILogEventSink, IDisposable
{
    private readonly HttpClient _client;
    private readonly Uri _endpoint;
    private readonly string _application;
    private readonly string _environment;
    private readonly string _tenant;

    public LokiHttpSink(string endpoint, string application, string environment, string? tenant = null)
    {
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            throw new ArgumentException("Loki endpoint must be an absolute HTTP(S) URL.", nameof(endpoint));

        _endpoint = uri;
        _application = application;
        _environment = environment;
        _tenant = string.IsNullOrWhiteSpace(tenant) ? "shared" : tenant;
        _client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
    }

    public void Emit(LogEvent logEvent)
    {
        var rendered = logEvent.RenderMessage(CultureInfo.InvariantCulture);
        var value = new[]
        {
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture) + "000000",
            rendered
        };
        var payload = new LokiPushRequest(new[]
        {
            new LokiStream(new Dictionary<string, string>
            {
                ["application"] = _application,
                ["environment"] = _environment,
                ["tenant"] = _tenant,
                ["level"] = logEvent.Level.ToString()
            }, new[] { value })
        });

        _ = PushAsync(payload);
    }

    private async Task PushAsync(LokiPushRequest payload)
    {
        try
        {
            using var response = await _client.PostAsJsonAsync(_endpoint, payload).ConfigureAwait(false);
            response.Dispose();
        }
        catch (Exception) when (true)
        {
            // Loki is an observability dependency. Never recurse through Serilog on failure.
        }
    }

    public void Dispose() => _client.Dispose();

    private sealed record LokiPushRequest([property: JsonPropertyName("streams")] IReadOnlyList<LokiStream> Streams);
    private sealed record LokiStream(
        [property: JsonPropertyName("stream")] IReadOnlyDictionary<string, string> Stream,
        [property: JsonPropertyName("values")] IReadOnlyList<string[]> Values);
}
