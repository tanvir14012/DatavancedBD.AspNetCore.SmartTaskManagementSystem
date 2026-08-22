using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.AssemblyScan;

public static class ValidationExtensions
{
    public static IServiceCollection AddAssemblyValidators<TMarker>(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<TMarker>(ServiceLifetime.Scoped, includeInternalTypes: false);
        return services;
    }
}

/// <summary>
/// MediatR pipeline behavior that runs FluentValidation validators before the handler.
/// Throws <see cref="ValidationException"/> when validation fails.
/// </summary>
public sealed class ValidationPipelineBehavior<TRequest, TResponse>(
    IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!validators.Any())
            return await next();

        var context = new ValidationContext<TRequest>(request);
        var failures = validators
            .Select(v => v.Validate(context))
            .SelectMany(r => r.Errors)
            .Where(f => f != null)
            .ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        return await next();
    }
}
