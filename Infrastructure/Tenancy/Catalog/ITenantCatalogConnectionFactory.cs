using System.Data.Common;

namespace Infrastructure.Tenancy.Catalog;

/// <summary>Creates catalog connections without resolving a tenant or opening a network connection.</summary>
public interface ITenantCatalogConnectionFactory
{
    /// <summary>Returns a new unopened connection. The caller owns opening and asynchronously disposing it.</summary>
    DbConnection CreateConnection();
}
