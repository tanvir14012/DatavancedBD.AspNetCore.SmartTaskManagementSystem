using System.Collections.Concurrent;
using Application.Tenancy;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Migrations;

/// <summary>
/// Runs reviewed migrations against physical targets, not request-scoped tenant contexts.
/// Target identity is deduplicated before work starts; the lock and ledger remain authoritative
/// when more than one Admin process is active or a previous run was interrupted.
/// </summary>
public sealed class TenantMigrationRunner : ITenantMigrationRunner
{
    private readonly IMigrationTargetSource _source;
    private readonly IMigrationTargetLockProvider _locks;
    private readonly IMigrationTargetExecutor _executor;
    private readonly IMigrationLedger _ledger;
    private readonly int _maxConcurrency;

    public TenantMigrationRunner(
        IMigrationTargetSource source,
        IMigrationTargetLockProvider locks,
        IMigrationTargetExecutor executor,
        IMigrationLedger ledger,
        IOptions<TenantMigrationOptions>? options = null)
    {
        _source = source ?? throw new ArgumentNullException(nameof(source));
        _locks = locks ?? throw new ArgumentNullException(nameof(locks));
        _executor = executor ?? throw new ArgumentNullException(nameof(executor));
        _ledger = ledger ?? throw new ArgumentNullException(nameof(ledger));
        _maxConcurrency = options?.Value.MaxConcurrency ?? 2;
        if (_maxConcurrency is < 1 or > 32)
            throw new ArgumentOutOfRangeException(nameof(options), "Migration concurrency must be between 1 and 32.");
    }

    public async Task<IReadOnlyList<MigrationOutcome>> RunAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var targets = new Dictionary<string, MigrationTarget>(StringComparer.Ordinal);

        await foreach (var target in _source.ReadAsync(cancellationToken).WithCancellation(cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();
            ValidateTarget(target);
            targets.TryAdd(Key(target), target);
        }

        var outcomes = new ConcurrentBag<(int Index, MigrationOutcome Outcome)>();
        await Parallel.ForEachAsync(
            targets.Values.Select((target, index) => (target, index)),
            new ParallelOptions { MaxDegreeOfParallelism = _maxConcurrency, CancellationToken = cancellationToken },
            async (item, token) =>
            {
                var outcome = await MigrateOneAsync(item.target, token).ConfigureAwait(false);
                outcomes.Add((item.index, outcome));
            });

        return outcomes
            .OrderBy(item => item.Index)
            .Select(item => item.Outcome)
            .ToArray();
    }

    private async Task<MigrationOutcome> MigrateOneAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        try
        {
            await using var lease = await _locks.AcquireAsync(target, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();

            if (await _ledger.IsAppliedAsync(target, cancellationToken).ConfigureAwait(false))
                return new MigrationOutcome(target, true, null);

            await _executor.ExecuteAsync(target, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            await _ledger.RecordAppliedAsync(target, cancellationToken).ConfigureAwait(false);
            return new MigrationOutcome(target, true, null);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception error)
        {
            return new MigrationOutcome(target, false, ErrorCode(error));
        }
    }

    private static void ValidateTarget(MigrationTarget target)
    {
        ArgumentNullException.ThrowIfNull(target);
        if (string.IsNullOrWhiteSpace(target.TargetId))
            throw new InvalidDataException("Migration target has no logical identifier.");
        if (!Enum.IsDefined(target.Isolation))
            throw new InvalidDataException("Migration target has an unknown isolation strategy.");
        if (target.Isolation == TenantIsolation.Schema && string.IsNullOrWhiteSpace(target.Schema))
            throw new InvalidDataException("Schema migration target has no schema.");
        if (target.Isolation != TenantIsolation.Schema && target.Schema is not null)
            throw new InvalidDataException("Only schema targets may specify a schema.");
    }

    private static string Key(MigrationTarget target)
        => $"{target.TargetId}\u001f{target.Schema}\u001f{(int)target.Isolation}";

    private static string ErrorCode(Exception error)
        => error switch
        {
            InvalidDataException => "INVALID_TARGET",
            TimeoutException => "TIMEOUT",
            UnauthorizedAccessException => "UNAUTHORIZED",
            _ => "MIGRATION_FAILED"
        };
}

/// <summary>Process-local lock useful for a single Admin process and deterministic tests.</summary>
public sealed class InProcessMigrationTargetLockProvider : IMigrationTargetLockProvider
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new(StringComparer.Ordinal);

    public async Task<IAsyncDisposable> AcquireAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        var gate = _locks.GetOrAdd(Key(target), static _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        return new Lease(gate);
    }

    private static string Key(MigrationTarget target) =>
        $"{target.TargetId}\u001f{target.Schema}\u001f{(int)target.Isolation}";

    private sealed class Lease(SemaphoreSlim gate) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            gate.Release();
            return ValueTask.CompletedTask;
        }
    }
}

/// <summary>In-memory ledger for local dry runs; production uses a durable SQL implementation.</summary>
public sealed class InMemoryMigrationLedger : IMigrationLedger
{
    private readonly ConcurrentDictionary<string, byte> _completed = new(StringComparer.Ordinal);

    public Task<bool> IsAppliedAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(_completed.ContainsKey(Key(target)));
    }

    public Task RecordAppliedAsync(MigrationTarget target, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        _completed[Key(target)] = 0;
        return Task.CompletedTask;
    }

    private static string Key(MigrationTarget target) =>
        $"{target.TargetId}\u001f{target.Schema}\u001f{(int)target.Isolation}";
}
