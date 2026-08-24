using Application.Interfaces;
using Application.Models;
using Infrastructure.Caching.Keys;
using Infrastructure.Caching.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Usm.Shared.Http.ResponseCaching.Metadata;
using Usm.Shared.Http.ResponseCaching.Models;

namespace Infrastructure.Caching.Middlewears;

public sealed class HttpResponseCachingMiddleware(
    ICacheService cacheService,
    ICacheKeyGenerator keyGenerator,
    IOptions<HttpResponseCachingOptions> options,
    ILogger<HttpResponseCachingMiddleware> logger) : IMiddleware
{
    private readonly ICacheService _cacheService = cacheService;
    private readonly ICacheKeyGenerator _keyGenerator = keyGenerator;
    private readonly HttpResponseCachingOptions _options = options.Value;
    private readonly ILogger<HttpResponseCachingMiddleware> _logger = logger;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        if (!HttpMethods.IsGet(context.Request.Method))
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        var metadata = ResolveMetadata(context);
        if (metadata.Enabled is false)
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        var key = BuildCacheKey(context, metadata);
        var cachedResponse = await _cacheService.GetAsync<HttpCachedResponse>(key, context.RequestAborted).ConfigureAwait(false);
        if (cachedResponse is not null)
        {
            await WriteCachedResponseAsync(context, cachedResponse, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        var originalBodyStream = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;

        try
        {
            await next(context).ConfigureAwait(false);
            var shouldCache = ShouldCacheResponse(context.Response);
            if (shouldCache)
            {
                responseBuffer.Position = 0;
                var payload = new byte[checked((int)responseBuffer.Length)];
                await responseBuffer.ReadExactlyAsync(payload, context.RequestAborted).ConfigureAwait(false);

                var responseToCache = new HttpCachedResponse
                {
                    StatusCode = context.Response.StatusCode,
                    ContentType = context.Response.ContentType,
                    Headers = context.Response.Headers
                        .Where(static header => !IsIgnoredHeader(header.Key))
                        .ToDictionary(
                            static pair => pair.Key,
                            static pair => pair.Value.ToArray(),
                            StringComparer.OrdinalIgnoreCase),
                    Body = payload
                };

                await _cacheService.SetAsync(
                    key,
                    responseToCache,
                    new CacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(metadata.DurationSeconds ?? _options.DefaultDurationSeconds)
                    },
                    context.RequestAborted).ConfigureAwait(false);
            }

            responseBuffer.Position = 0;
            await responseBuffer.CopyToAsync(originalBodyStream, context.RequestAborted).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to process HTTP response cache for {Path}.", context.Request.Path);
            throw;
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }

    private CacheResponseMetadata ResolveMetadata(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        var fromEndpoint = endpoint?.Metadata.GetMetadata<CacheResponseMetadata>();
        if (fromEndpoint is not null)
            return fromEndpoint;

        var fromAttribute = endpoint?.Metadata.GetMetadata<CacheResponseAttribute>();
        if (fromAttribute is null)
            return new CacheResponseMetadata();

        return new CacheResponseMetadata
        {
            Enabled = fromAttribute.Enabled,
            DurationSeconds = fromAttribute.DurationSeconds,
            VaryByAuthenticatedUser = fromAttribute.VaryByAuthenticatedUser,
            VaryByHeaders = fromAttribute.VaryByHeaders
        };
    }

    private string BuildCacheKey(HttpContext context, CacheResponseMetadata metadata)
    {
        var route = context.GetEndpoint() is { } endpoint
            ? endpoint.DisplayName ?? context.Request.Path.Value ?? "/"
            : context.Request.Path.Value ?? "/";

        var queryPart = _options.IncludeQueryString
            ? NormalizeQueryString(context.Request.Query)
            : string.Empty;

        var headerNames = _options.VaryByHeaders
            .Concat(metadata.VaryByHeaders)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(static header => header, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var headerPart = string.Join('|',
            headerNames.Select(header =>
                $"{header}={context.Request.Headers[header].ToString()}"));

        var includeUser = metadata.VaryByAuthenticatedUser ?? _options.CacheAuthenticatedUser;
        var userPart = includeUser
            ? context.User.Identity?.Name ?? context.User.FindFirst("sub")?.Value ?? "anonymous"
            : "all-users";

        return _keyGenerator.Build(_options.KeyNamespace, route, queryPart, headerPart, userPart);
    }

    private static string NormalizeQueryString(IQueryCollection query)
    {
        if (query.Count == 0)
            return string.Empty;

        return string.Join('&',
            query.OrderBy(static pair => pair.Key, StringComparer.OrdinalIgnoreCase)
                .Select(static pair => $"{pair.Key}={string.Join(',', pair.Value.ToArray())}"));
    }

    private static async Task WriteCachedResponseAsync(
        HttpContext context,
        HttpCachedResponse cachedResponse,
        CancellationToken cancellationToken)
    {
        context.Response.StatusCode = cachedResponse.StatusCode;
        context.Response.ContentType = cachedResponse.ContentType;

        foreach (var (key, values) in cachedResponse.Headers)
            context.Response.Headers[key] = values;

        context.Response.ContentLength = cachedResponse.Body.LongLength;
        await context.Response.Body.WriteAsync(cachedResponse.Body, cancellationToken).ConfigureAwait(false);
    }

    private static bool ShouldCacheResponse(HttpResponse response)
    {
        return response.StatusCode is >= 200 and < 300;
    }

    private static bool IsIgnoredHeader(string headerName)
    {
        return headerName.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase)
            || headerName.Equals("Date", StringComparison.OrdinalIgnoreCase)
            || headerName.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase)
            || headerName.Equals("Content-Length", StringComparison.OrdinalIgnoreCase);
    }
}
