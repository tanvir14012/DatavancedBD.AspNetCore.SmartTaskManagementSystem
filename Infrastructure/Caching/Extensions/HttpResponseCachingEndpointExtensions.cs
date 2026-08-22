using Microsoft.AspNetCore.Builder;
using Usm.Shared.Http.ResponseCaching.Metadata;

namespace Infrastructure.Caching.Extensions;

public static class HttpResponseCachingEndpointExtensions
{
    public static TBuilder CacheResponse<TBuilder>(
        this TBuilder builder,
        int durationSeconds,
        bool varyByAuthenticatedUser = false,
        params string[] varyByHeaders)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new CacheResponseMetadata
        {
            DurationSeconds = durationSeconds,
            VaryByAuthenticatedUser = varyByAuthenticatedUser,
            VaryByHeaders = varyByHeaders
                .Where(static header => !string.IsNullOrWhiteSpace(header))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray()
        });

        return builder;
    }

    public static TBuilder DisableResponseCaching<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.WithMetadata(new CacheResponseMetadata
        {
            Enabled = false
        });

        return builder;
    }
}
