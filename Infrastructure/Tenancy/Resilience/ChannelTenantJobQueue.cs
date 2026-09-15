using System.Threading.Channels;
using Application.Tenancy;

namespace Infrastructure.Tenancy.Resilience;

/// <summary>
/// Bounded in-process queue for local development and tests. Production deployments should replace
/// this adapter with a durable queue that implements the same ack/abandon contract.
/// </summary>
public sealed class ChannelTenantJobQueue : ITenantJobQueue
{
    private readonly Channel<TenantWorkItem> _channel;

    public ChannelTenantJobQueue(int capacity = 256)
    {
        if (capacity is < 1 or > 100_000) throw new ArgumentOutOfRangeException(nameof(capacity));
        _channel = Channel.CreateBounded<TenantWorkItem>(new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = false,
            SingleWriter = false
        });
    }

    public ValueTask EnqueueAsync(TenantWorkItem item, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(item);
        return _channel.Writer.WriteAsync(item, cancellationToken);
    }

    public IAsyncEnumerable<TenantWorkItem> ReadAsync(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);

    public Task CompleteAsync(TenantWorkItem item, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.CompletedTask;
    }

    public async Task AbandonAsync(TenantWorkItem item, bool retryable, CancellationToken cancellationToken)
    {
        if (retryable)
            await _channel.Writer.WriteAsync(item, cancellationToken).ConfigureAwait(false);
    }

    public bool TryComplete() => _channel.Writer.TryComplete();
}
