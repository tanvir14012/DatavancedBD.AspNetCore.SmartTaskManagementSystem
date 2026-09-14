using Application.Tenancy;
using Application.Tenancy.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Api.Tenancy;

/// <summary>Opt-in organization authorization composed through ASP.NET Core endpoint policies.</summary>
/// <remarks>
/// Register a validated authentication scheme with unmapped sub/iss/tenant_id claims, a resolver,
/// durable membership reader and authoritative catalog. UseRouting -> UseAuthentication ->
/// UseAuthorization must precede response caching and tenant persistence. Forwarded hosts must be
/// validated by trusted-proxy middleware; this module never reads forwarded headers directly.
/// Legacy application endpoints remain unregistered until tenant storage and token issuance are ready.
/// </remarks>
public static class TenantPipeline
{
    /// <summary>The endpoint authorization policy requiring an organization-bound authentication ticket.</summary>
    public const string PolicyName = "SaasTenant";

    /// <summary>Registers scoped context, membership validation and the policy without connecting to any backing service.</summary>
    public static IServiceCollection AddTenantAuthorization(this IServiceCollection services, string authenticationScheme)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(authenticationScheme);
        services.TryAddScoped<TenantContextScope>();
        services.TryAddScoped<ITenantContextAccessor>(provider => provider.GetRequiredService<TenantContextScope>());
        services.TryAddScoped<ITenantContextInitializer>(provider => provider.GetRequiredService<TenantContextScope>());
        services.TryAddScoped<ITenantAccessValidator, TenantAccessValidator>();
        services.TryAddScoped<TenantContextAuthorizer>();
        services.TryAddEnumerable(ServiceDescriptor.Scoped<IAuthorizationHandler, TenantAuthorizationHandler>());
        services.AddAuthorization(options => options.AddPolicy(PolicyName, policy => policy
            .AddAuthenticationSchemes(authenticationScheme)
            .RequireAuthenticatedUser()
            .AddRequirements(new TenantAccessRequirement())));
        return services;
    }

    /// <summary>Requires the tenant policy. Missing policy/handler configuration cannot silently allow the endpoint.</summary>
    public static TBuilder RequireTenantContext<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.RequireAuthorization(PolicyName);
        builder.Finally(endpoint =>
        {
            if (endpoint.Metadata.OfType<IAllowAnonymous>().Any())
                throw new InvalidOperationException("Tenant endpoints cannot allow anonymous access.");
        });
        return builder;
    }
}
