using System.Data;
using System.Data.Common;
using Application.Tenancy;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Atomically writes catalog placements with an expected-revision compare-and-set.</summary>
/// <remarks>
/// The serializable range lock prevents two initial writers from racing into the same primary key.
/// The cache is deliberately not touched here; callers publish only after this command commits.
/// </remarks>
public sealed class AzureSqlTenantCatalogWriter : ITenantCatalogWriter
{
    private const string SavePlacementSql = """
        SET XACT_ABORT ON;
        BEGIN TRANSACTION;
        DECLARE @Applied bit = 0;
        DECLARE @CurrentVersion bigint;
        IF EXISTS
        (
            SELECT 1 FROM [catalog].[TenantPlacements] WITH (UPDLOCK, HOLDLOCK)
            WHERE [TenantId] = @TenantId
        )
        BEGIN
            SELECT @CurrentVersion = [Version]
            FROM [catalog].[TenantPlacements] WITH (UPDLOCK, HOLDLOCK)
            WHERE [TenantId] = @TenantId;
            IF @CurrentVersion = @ExpectedVersion
            BEGIN
                UPDATE [catalog].[TenantPlacements]
                SET [Isolation] = @Isolation, [TargetId] = @TargetId, [SchemaName] = @SchemaName,
                    [Region] = @Region, [Version] = @NewVersion, [Lifecycle] = @Lifecycle
                WHERE [TenantId] = @TenantId;
                SET @Applied = 1;
            END
        END
        ELSE IF @ExpectedVersion = 0
        BEGIN
            INSERT INTO [catalog].[TenantPlacements]
                ([TenantId], [Isolation], [TargetId], [SchemaName], [Region], [Version], [Lifecycle])
            VALUES
                (@TenantId, @Isolation, @TargetId, @SchemaName, @Region, @NewVersion, @Lifecycle);
            SET @Applied = 1;
        END
        COMMIT TRANSACTION;
        SELECT @Applied;
        """;

    private readonly ITenantCatalogConnectionFactory _connections;
    private readonly int _commandTimeoutSeconds;
    private readonly TimeSpan _writeTimeout;
    private readonly TimeProvider _timeProvider;

    /// <summary>Captures validated finite write settings without opening a connection.</summary>
    public AzureSqlTenantCatalogWriter(
        ITenantCatalogConnectionFactory connections,
        IOptions<TenantCatalogReadOptions> options,
        TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(connections);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(timeProvider);
        var settings = options.Value;
        settings.Validate();
        _connections = connections;
        _commandTimeoutSeconds = settings.CommandTimeoutSeconds;
        _writeTimeout = TimeSpan.FromSeconds(settings.LookupTimeoutSeconds);
        _timeProvider = timeProvider;
    }

    /// <inheritdoc />
    public async Task<bool> TrySaveAsync(TenantPlacement placement, long expectedVersion, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(placement);
        if (expectedVersion < 0)
            throw new ArgumentOutOfRangeException(nameof(expectedVersion), "Expected revision cannot be negative.");
        if (placement.Version <= expectedVersion)
            throw new ArgumentException("New placement revision must exceed the expected revision.", nameof(placement));
        cancellationToken.ThrowIfCancellationRequested();

        using var timeout = new CancellationTokenSource(_writeTimeout, _timeProvider);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            var applied = await SaveCoreAsync(placement, expectedVersion, cancellationToken, deadline.Token)
                .ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            if (timeout.IsCancellationRequested)
                throw new TimeoutException("The tenant catalog write deadline expired.");
            return applied;
        }
        catch
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (timeout.IsCancellationRequested)
                throw new TimeoutException("The tenant catalog write deadline expired.");
            throw;
        }
    }

    private async Task<bool> SaveCoreAsync(
        TenantPlacement placement,
        long expectedVersion,
        CancellationToken callerToken,
        CancellationToken operationToken)
    {
        await using var connection = _connections.CreateConnection();
        await connection.OpenAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(callerToken, operationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = SavePlacementSql;
        command.CommandType = CommandType.Text;
        command.CommandTimeout = _commandTimeoutSeconds;
        AddParameter(command, "@TenantId", DbType.Guid, placement.TenantId);
        AddParameter(command, "@Isolation", DbType.Byte, (byte)placement.Isolation);
        AddParameter(command, "@TargetId", DbType.String, placement.TargetId, 128);
        AddParameter(command, "@SchemaName", DbType.String, (object?)placement.Schema ?? DBNull.Value, 128);
        AddParameter(command, "@Region", DbType.String, placement.Region, 128);
        AddParameter(command, "@NewVersion", DbType.Int64, placement.Version);
        AddParameter(command, "@Lifecycle", DbType.Byte, (byte)placement.Lifecycle);
        AddParameter(command, "@ExpectedVersion", DbType.Int64, expectedVersion);

        var result = await command.ExecuteScalarAsync(operationToken).ConfigureAwait(false);
        ThrowIfCanceled(callerToken, operationToken);
        return result switch
        {
            bool applied => applied,
            byte applied => applied is 0 or 1 ? applied == 1 : throw InvalidResult(),
            short applied => applied is 0 or 1 ? applied == 1 : throw InvalidResult(),
            int applied => applied is 0 or 1 ? applied == 1 : throw InvalidResult(),
            long applied => applied is 0 or 1 ? applied == 1 : throw InvalidResult(),
            _ => throw InvalidResult()
        };
    }

    private static void AddParameter(DbCommand command, string name, DbType type, object value, int? size = null)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = type;
        if (size.HasValue)
            parameter.Size = size.Value;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static InvalidDataException InvalidResult()
        => new("The tenant catalog write returned an invalid result.");

    private static void ThrowIfCanceled(CancellationToken caller, CancellationToken operation)
    {
        caller.ThrowIfCancellationRequested();
        operation.ThrowIfCancellationRequested();
    }
}
