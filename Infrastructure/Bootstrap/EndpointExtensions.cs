using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Bootstrap;

public static class EndpointExtensions
{
    public static IServiceCollection AddEndpoints(
        this IServiceCollection services,
        params Assembly[] assemblies)
    {
        var endpointType = typeof(IEndpoint);

        var types = assemblies
            .SelectMany(x => x.GetTypes())
            .Where(t =>
                !t.IsAbstract &&
                endpointType.IsAssignableFrom(t));

        foreach (var type in types)
        {
            services.AddSingleton(endpointType, type);
        }

        return services;
    }

    public static WebApplication MapEndpoints(
        this WebApplication app)
    {
        foreach (var endpoint in app.Services.GetServices<IEndpoint>())
        {
            endpoint.MapEndpoint(app);
        }

        return app;
    }
}
