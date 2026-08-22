using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.AssemblyScan;

public static class ServiceRegistratonExtension
{
    public static IServiceCollection AddScopedServices(
        this IServiceCollection services,
        params Assembly[] assemblies)
    {
        services.Scan(scan => scan
            .FromAssemblies(assemblies)
            .AddClasses(c => c.AssignableTo<IScopedService>())
            .AsMatchingInterface()
            .WithScopedLifetime());

        return services;
    }

    public static IServiceCollection AddTransientServices(
        this IServiceCollection services,
        params Assembly[] assemblies)
    {
        services.Scan(scan => scan
            .FromAssemblies(assemblies)
            .AddClasses(c => c.AssignableTo<ITransientService>())
            .AsMatchingInterface()
            .WithTransientLifetime());

        return services;
    }

    public static IServiceCollection AddSingletonServices(
        this IServiceCollection services,
        params Assembly[] assemblies)
    {
        services.Scan(scan => scan
            .FromAssemblies(assemblies)
            .AddClasses(c => c.AssignableTo<ISingletonService>())
            .AsMatchingInterface()
            .WithSingletonLifetime());

        return services;
    }
}
