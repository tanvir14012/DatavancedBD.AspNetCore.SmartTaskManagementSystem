using System.Linq.Expressions;
using Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Extensions;

public static class ModelBuilderExtensions
{

    public static void ApplySoftDeleteFilter<TEntity>(this EntityTypeBuilder<TEntity> builder)
        where TEntity : class, ISoftDeletable
    {
        builder.HasQueryFilter(entity => !entity.IsDeleted);
    }

    public static void ApplyTenantFilter<TEntity>(this EntityTypeBuilder<TEntity> builder, Guid tenantId)
        where TEntity : class, IMultiTenant
    {
        builder.HasQueryFilter(entity => entity.TenantId == tenantId);
    }
}

public static class DbContextQueryExtensions
{
    public static IQueryable<TEntity> ExcludingDeleted<TEntity>(this IQueryable<TEntity> source)
        where TEntity : class, ISoftDeletable
    {
        return source.Where(entity => !entity.IsDeleted);
    }

    public static IQueryable<TEntity> ForTenant<TEntity>(this IQueryable<TEntity> source, Guid tenantId)
        where TEntity : class, IMultiTenant
    {
        return source.Where(entity => entity.TenantId == tenantId);
    }

    public static Task<bool> ExistsDuplicateAsync<TEntity>(
        this DbSet<TEntity> dbSet,
        Expression<Func<TEntity, bool>> predicate,
        CancellationToken cancellationToken = default)
        where TEntity : class
    {
        return dbSet.AnyAsync(predicate, cancellationToken);
    }
}
