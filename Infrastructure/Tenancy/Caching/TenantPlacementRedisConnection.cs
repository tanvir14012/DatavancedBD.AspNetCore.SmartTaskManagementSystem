using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Tenancy.Caching;

/// <summary>Owns one lazily resolved DI singleton multiplexer for placement cache operations.</summary>
/// <remarks>Construction is the explicit provider boundary; registration itself performs no network I/O.</remarks>
public sealed class TenantPlacementRedisConnection : IDisposable
{
    /// <summary>Creates a bounded multiplexer from externally supplied configuration.</summary>
    public TenantPlacementRedisConnection(IOptions<TenantPlacementRedisOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var settings = options.Value;
        settings.Validate();
        try
        {
            var configuration = ConfigurationOptions.Parse(settings.ConnectionString, true);
            configuration.AbortOnConnectFail = false;
            configuration.ConnectTimeout = settings.CommandTimeoutMilliseconds;
            configuration.SyncTimeout = settings.CommandTimeoutMilliseconds;
            configuration.AsyncTimeout = settings.CommandTimeoutMilliseconds;
            configuration.ConnectRetry = 1;
            Multiplexer = ConnectionMultiplexer.Connect(configuration);
        }
        catch (ArgumentException)
        {
            // Endpoint/credential text is provider input; do not preserve it in a public configuration error.
            throw new ArgumentException("Tenant placement Redis settings are invalid.", nameof(options));
        }
    }

    /// <summary>The process-wide connection pool for this placement cache.</summary>
    public IConnectionMultiplexer Multiplexer { get; }

    /// <inheritdoc />
    public void Dispose() => Multiplexer.Dispose();
}
