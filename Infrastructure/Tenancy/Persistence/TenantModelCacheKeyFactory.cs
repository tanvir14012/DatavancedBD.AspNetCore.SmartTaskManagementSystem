using Infrastructure.Data.EfCore.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Infrastructure.Tenancy.Persistence;

/// <summary>Shares row models across organizations, but separates schemas and the legacy model.</summary>
public sealed class TenantModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime) => context is AppDbContext app
        ? (context.GetType(), app.IsTenantStorage, app.StorageSchema, designTime)
        : (object)(context.GetType(), designTime);
}
