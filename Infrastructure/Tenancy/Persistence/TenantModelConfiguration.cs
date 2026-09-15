using System.Linq.Expressions;
using Domain.Interfaces;
using Infrastructure.Data.EfCore.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Infrastructure.Tenancy.Persistence;

internal static class TenantModelConfiguration
{
    internal static void Apply(ModelBuilder builder, AppDbContext context)
    {
        var entities = builder.Model.GetEntityTypes().ToArray();
        // Fail explicitly if later model changes require a different mapping convention.
        if (entities.Any(e => e.IsOwned() || e.BaseType != null || e.FindPrimaryKey() == null))
            throw new InvalidOperationException("Tenant storage requires keyed root entities: " +
                string.Join(", ", entities.Where(e => e.IsOwned() || e.BaseType != null || e.FindPrimaryKey() == null).Select(e => e.Name)));

        var keys = entities.ToDictionary(e => e, e => e.GetKeys().ToArray());
        var generatedIds = entities.Where(e => e.FindPrimaryKey()!.Properties.Count == 1 &&
            e.FindPrimaryKey()!.Properties[0].ClrType == typeof(int))
            .Select(e => (Entity: e, Property: e.FindPrimaryKey()!.Properties[0].Name)).ToArray();
        var foreignKeys = entities.SelectMany(e => e.GetForeignKeys()).ToArray();
        var replacements = new Dictionary<IMutableKey, IMutableKey>();

        foreach (var entity in entities)
        {
            var tenant = builder.Entity(entity.ClrType).Property<Guid>("TenantId").IsRequired()
                .IsConcurrencyToken().ValueGeneratedNever().Metadata;
            foreach (var key in keys[entity])
            {
                var replacement = entity.AddKey(new[] { tenant }.Concat(key.Properties).ToArray());
                replacements[key] = replacement;
                if (key.IsPrimaryKey()) entity.SetPrimaryKey(replacement.Properties);
            }

            var parameter = Expression.Parameter(entity.ClrType, "entity");
            var tenantAccess = Expression.Call(typeof(EF), nameof(EF.Property), new[] { typeof(Guid) },
                parameter, Expression.Constant("TenantId"));
            Expression predicate = Expression.Equal(tenantAccess,
                Expression.Property(Expression.Constant(context), nameof(AppDbContext.TenantId)));
            if (typeof(ISoftDeletable).IsAssignableFrom(entity.ClrType))
                predicate = Expression.AndAlso(predicate,
                    Expression.Not(Expression.Property(parameter, nameof(ISoftDeletable.IsDeleted))));
            builder.Entity(entity.ClrType).HasQueryFilter(Expression.Lambda(predicate, parameter));
        }

        foreach (var foreignKey in foreignKeys)
        {
            var tenant = foreignKey.DeclaringEntityType.FindProperty("TenantId")!;
            foreignKey.SetProperties(new[] { tenant }.Concat(foreignKey.Properties).ToArray(),
                replacements[foreignKey.PrincipalKey]);
        }

        foreach (var entity in entities)
        {
            foreach (var oldKey in keys[entity]) entity.RemoveKey(oldKey);
        }

        foreach (var index in entities.SelectMany(e => e.GetIndexes()).ToArray())
        {
            if (index.Properties[0].Name == "TenantId") continue;
            var entity = index.DeclaringEntityType;
            var properties = new[] { entity.FindProperty("TenantId")! }.Concat(index.Properties).ToArray();
            var unique = index.IsUnique;
            var name = index.GetDatabaseName();
            var filter = index.GetFilter();
            entity.RemoveIndex(index);
            var replacement = entity.AddIndex(properties);
            replacement.IsUnique = unique;
            replacement.SetDatabaseName(name);
            replacement.SetFilter(filter);
        }

        // Composite keys disable EF's conventional int identity generation; retain generated IDs.
        foreach (var id in generatedIds) builder.Entity(id.Entity.ClrType).Property<int>(id.Property).UseIdentityColumn();
        foreach (var entity in entities)
            foreach (var property in entity.FindPrimaryKey()!.Properties.Where(p => p.ClrType == typeof(string) && p.GetMaxLength() == null))
                property.SetMaxLength(128);
    }
}
