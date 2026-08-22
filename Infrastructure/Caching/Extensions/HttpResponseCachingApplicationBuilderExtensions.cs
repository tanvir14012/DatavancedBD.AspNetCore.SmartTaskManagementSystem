using Infrastructure.Caching.Middlewears;
using Microsoft.AspNetCore.Builder;


namespace Infrastructure.Caching.Extensions;

public static class HttpResponseCachingApplicationBuilderExtensions
{
    public static IApplicationBuilder UseHttpResponseCaching(this IApplicationBuilder app)
    {
        return app.UseMiddleware<HttpResponseCachingMiddleware>();
    }
}
