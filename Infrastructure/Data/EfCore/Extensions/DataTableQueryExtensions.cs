using System.ComponentModel;
using System.Linq.Expressions;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.EfCore.Extensions;

public sealed class DataTableRequest
{
    public int Start { get; init; }
    public int Length { get; init; } = 20;
    public string? Search { get; init; }
    public string? SortColumn { get; init; }
    public string? SortDirection { get; init; }
    public IReadOnlyDictionary<string, string?> DropdownFilters { get; init; } = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
}

public sealed record DataTablePage<T>(int TotalCount, int FilteredCount, IReadOnlyList<T> Items);

public sealed class DataTableQueryConfiguration
{
    public ISet<string> SearchableColumns { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    public ISet<string> SortableColumns { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    public ISet<string> FilterableColumns { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    public int MaxPageSize { get; init; } = 200;
}

public static class DataTableModelBuilderExtensions
{
    private const string SearchableColumnsAnnotation = "stms:datatable:searchable";
    private const string LocalizedSearchableColumnsAnnotation = "stms:datatable:searchable-localized";
    private const string SortableColumnsAnnotation = "stms:datatable:sortable";
    private const string FilterableColumnsAnnotation = "stms:datatable:filterable";

    public static EntityTypeBuilder<TEntity> ConfigureDataTable<TEntity>(
        this EntityTypeBuilder<TEntity> builder,
        IEnumerable<string>? searchableColumns = null,
        IEnumerable<string>? localizedSearchableColumns = null,
        IEnumerable<string>? sortableColumns = null,
        IEnumerable<string>? filterableColumns = null)
        where TEntity : class
    {
        builder.Metadata.SetAnnotation(SearchableColumnsAnnotation, Serialize(searchableColumns));
        builder.Metadata.SetAnnotation(LocalizedSearchableColumnsAnnotation, Serialize(localizedSearchableColumns));
        builder.Metadata.SetAnnotation(SortableColumnsAnnotation, Serialize(sortableColumns));
        builder.Metadata.SetAnnotation(FilterableColumnsAnnotation, Serialize(filterableColumns));
        return builder;
    }

    internal static DataTableQueryConfiguration GetDataTableConfiguration<TEntity>(
        DbContext dbContext,
        DataTableQueryConfiguration? overrideConfiguration)
        where TEntity : class
    {
        if (overrideConfiguration is not null)
            return overrideConfiguration;

        var entityType = dbContext.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"Entity {typeof(TEntity).Name} was not found in EF model.");

        var configuration = new DataTableQueryConfiguration();
        AddAll(configuration.SearchableColumns, Deserialize(entityType.FindAnnotation(SearchableColumnsAnnotation)?.Value));
        AddAll(configuration.SortableColumns, Deserialize(entityType.FindAnnotation(SortableColumnsAnnotation)?.Value));
        AddAll(configuration.FilterableColumns, Deserialize(entityType.FindAnnotation(FilterableColumnsAnnotation)?.Value));
        return configuration;
    }

    private static string Serialize(IEnumerable<string>? columns)
        => string.Join('|', columns?.Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim()) ?? []);

    private static IEnumerable<string> Deserialize(object? annotationValue)
        => annotationValue?.ToString()?
            .Split('|', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            ?? [];

    private static void AddAll(ISet<string> destination, IEnumerable<string> source)
    {
        foreach (var item in source)
            destination.Add(item);
    }
}

public static class DataTableQueryExtensions
{
    private static readonly MethodInfo OrderByMethod = GetQueryableMethod(nameof(Queryable.OrderBy));
    private static readonly MethodInfo OrderByDescendingMethod = GetQueryableMethod(nameof(Queryable.OrderByDescending));

    public static async Task<DataTablePage<TProjection>> ToDataTablePageAsync<TEntity, TProjection>(
        this IQueryable<TEntity> source,
        DbContext dbContext,
        DataTableRequest request,
        Expression<Func<TEntity, TProjection>> projection,
        DataTableQueryConfiguration? configuration = null,
        CancellationToken cancellationToken = default)
        where TEntity : class
    {
        var queryConfiguration = DataTableModelBuilderExtensions.GetDataTableConfiguration<TEntity>(dbContext, configuration);
        var total = await source.CountAsync(cancellationToken);

        var filteredQuery = source
            .ApplyDropdownFilters(dbContext, request, queryConfiguration)
            .ApplySearch(dbContext, request, queryConfiguration);

        var filteredCount = await filteredQuery.CountAsync(cancellationToken);
        var orderedQuery = filteredQuery.ApplySort(dbContext, request, queryConfiguration);
        var pagedQuery = orderedQuery.ApplyPagination(request, queryConfiguration.MaxPageSize);
        var items = await pagedQuery.Select(projection).ToListAsync(cancellationToken);

        return new DataTablePage<TProjection>(total, filteredCount, items);
    }

    public static IQueryable<TEntity> ApplyPagination<TEntity>(
        this IQueryable<TEntity> source,
        DataTableRequest request,
        int maxPageSize = 200)
    {
        var start = request.Start < 0 ? 0 : request.Start;
        var length = request.Length <= 0 ? 20 : Math.Min(request.Length, maxPageSize);
        return source.Skip(start).Take(length);
    }

    public static IQueryable<TEntity> ApplySearch<TEntity>(
        this IQueryable<TEntity> source,
        DbContext dbContext,
        DataTableRequest request,
        DataTableQueryConfiguration configuration)
        where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(request.Search))
            return source;

        var entityType = dbContext.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"Entity {typeof(TEntity).Name} was not found in EF model.");

        var search = request.Search.Trim();
        var searchConstant = Expression.Constant(search, typeof(string));

        var parameter = Expression.Parameter(typeof(TEntity), "e");
        Expression? predicateBody = null;

        foreach (var column in configuration.SearchableColumns)
        {
            var property = entityType.FindProperty(column);
            if (property?.ClrType != typeof(string))
                continue;

            // e.ColumnName
            var propertyAccess = Expression.Property(parameter, column);

            // e.ColumnName.Contains(search)
            var call = Expression.Call(propertyAccess, StringContainsMethod, searchConstant);

            predicateBody = predicateBody is null ? call : Expression.OrElse(predicateBody, call);
        }

        if (predicateBody is null)
            return source;

        var lambda = Expression.Lambda<Func<TEntity, bool>>(predicateBody, parameter);
        return source.Where(lambda);
    }

    public static IQueryable<TEntity> ApplySort<TEntity>(
        this IQueryable<TEntity> source,
        DbContext dbContext,
        DataTableRequest request,
        DataTableQueryConfiguration configuration)
        where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(request.SortColumn) || !configuration.SortableColumns.Contains(request.SortColumn))
            return source;

        var entityType = dbContext.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"Entity {typeof(TEntity).Name} was not found in EF model.");
        var property = entityType.FindProperty(request.SortColumn);
        if (property is null)
            return source;

        var parameter = Expression.Parameter(typeof(TEntity), "e");
        var efProperty = Expression.Call(
            typeof(EF),
            nameof(EF.Property),
            [property.ClrType],
            parameter,
            Expression.Constant(request.SortColumn));

        var lambda = Expression.Lambda(efProperty, parameter);
        var method = IsDescending(request.SortDirection) ? OrderByDescendingMethod : OrderByMethod;
        var genericMethod = method.MakeGenericMethod(typeof(TEntity), property.ClrType);

        return (IQueryable<TEntity>)genericMethod.Invoke(null, [source, lambda])!;
    }

    public static IQueryable<TEntity> ApplyDropdownFilters<TEntity>(
        this IQueryable<TEntity> source,
        DbContext dbContext,
        DataTableRequest request,
        DataTableQueryConfiguration configuration)
        where TEntity : class
    {
        if (request.DropdownFilters.Count == 0)
            return source;

        var entityType = dbContext.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException($"Entity {typeof(TEntity).Name} was not found in EF model.");

        foreach (var (column, rawValue) in request.DropdownFilters)
        {
            if (string.IsNullOrWhiteSpace(rawValue) || !configuration.FilterableColumns.Contains(column))
                continue;

            var property = entityType.FindProperty(column);
            if (property is null)
                continue;

            var convertedValue = ConvertTo(rawValue, property.ClrType);
            source = source.Where(BuildEqualsPredicate<TEntity>(column, property.ClrType, convertedValue));
        }

        return source;
    }

    private static Expression<Func<TEntity, bool>> BuildEqualsPredicate<TEntity>(string columnName, Type propertyType, object? convertedValue)
        where TEntity : class
    {
        var parameter = Expression.Parameter(typeof(TEntity), "e");
        var left = Expression.Call(typeof(EF), nameof(EF.Property), [propertyType], parameter, Expression.Constant(columnName));
        var right = Expression.Constant(convertedValue, propertyType);
        var body = Expression.Equal(left, right);
        return Expression.Lambda<Func<TEntity, bool>>(body, parameter);
    }

    private static object? ConvertTo(string value, Type targetType)
    {
        var nonNullableType = Nullable.GetUnderlyingType(targetType) ?? targetType;
        if (nonNullableType == typeof(string))
            return value;
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var converter = TypeDescriptor.GetConverter(nonNullableType);
        if (!converter.CanConvertFrom(typeof(string)))
            throw new InvalidOperationException($"Cannot convert dropdown filter value to {nonNullableType.Name}.");

        return converter.ConvertFromInvariantString(value);
    }

    private static bool IsDescending(string? direction)
        => string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase)
            || string.Equals(direction, "descending", StringComparison.OrdinalIgnoreCase);

    private static MethodInfo GetQueryableMethod(string name)
        => typeof(Queryable).GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Single(method => method.Name == name
                              && method.IsGenericMethodDefinition
                              && method.GetGenericArguments().Length == 2
                              && method.GetParameters().Length == 2);
    private static readonly MethodInfo StringContainsMethod = typeof(string)
        .GetMethod(nameof(string.Contains), new[] { typeof(string) })!;
}
