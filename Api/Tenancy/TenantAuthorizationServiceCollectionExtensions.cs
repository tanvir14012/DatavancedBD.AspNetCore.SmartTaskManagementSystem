using Application.Tenancy.Authorization;
using Application.Tenancy.Resolution;
using Application.Tenancy;
using Infrastructure.Tenancy.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Api.Tenancy;

/// <summary>Composes the complete tenant request boundary from deployment configuration.</summary>
public static class TenantAuthorizationServiceCollectionExtensions
{
    /// <summary>External configuration key containing shared API authorities.</summary>
    public const string SharedApiAuthoritiesKey = "Saas:Tenancy:SharedApiAuthorities";

    /// <summary>
    /// Registers the SQL authority directory, resolver, membership validator and policy. No tenant
    /// inventory is read and no provider is contacted during service registration.
    /// </summary>
    public static IServiceCollection AddTenantAuthorization(
        this IServiceCollection services,
        IConfiguration configuration,
        string authenticationScheme = JwtBearerDefaults.AuthenticationScheme)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentException.ThrowIfNullOrWhiteSpace(authenticationScheme);

        services.TryAddSingleton<TenantResolutionOptions>(_ =>
            new TenantResolutionOptions(configuration.GetSection(SharedApiAuthoritiesKey).Get<string[]>() ?? []));
        services.TryAddSingleton<ITenantHostDirectory, SqlTenantHostDirectory>();
        services.TryAddSingleton<ITenantResolver, TenantRequestResolver>();
        services.TryAddScoped<ITenantMembershipReader, SqlTenantMembershipReader>();
        return services.AddTenantAuthorization(authenticationScheme);
    }
}
