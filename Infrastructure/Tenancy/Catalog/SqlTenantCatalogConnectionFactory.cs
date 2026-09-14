using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Creates owned catalog connections sharing one canonical, bounded SQL Client pool.</summary>
public sealed class SqlTenantCatalogConnectionFactory : ITenantCatalogConnectionFactory
{
    private readonly string _connectionString;

    /// <summary>Validates settings without opening a connection or obtaining an access token.</summary>
    public SqlTenantCatalogConnectionFactory(IOptions<SqlTenantCatalogConnectionOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var settings = options.Value;
        settings.Validate();
        try
        {
            var builder = new SqlConnectionStringBuilder(settings.ConnectionString)
            {
                ConnectTimeout = settings.ConnectTimeoutSeconds,
                MaxPoolSize = settings.MaxPoolSize,
                MinPoolSize = 0,
                Pooling = true,
                ApplicationIntent = ApplicationIntent.ReadWrite,
                ConnectRetryCount = 0,
                PersistSecurityInfo = false
            };
            if (string.IsNullOrWhiteSpace(builder.DataSource) || string.IsNullOrWhiteSpace(builder.InitialCatalog))
                throw new ArgumentException("A catalog server and database must be configured.");
            _connectionString = builder.ConnectionString;
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or OverflowException)
        {
            // SQL Client parsing errors can include credential values or unsupported connection keywords.
            throw new ArgumentException("Catalog connection settings are invalid.", nameof(options));
        }
    }

    /// <inheritdoc />
    public DbConnection CreateConnection() => new SqlConnection(_connectionString);
}
