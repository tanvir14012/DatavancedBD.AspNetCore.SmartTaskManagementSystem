using System.Diagnostics;
using System.Security.Claims;
using Application.Tenancy;
using Infrastructure.Data.EfCore.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Bootstrap.Middleware;

public sealed class AuditLoggingMiddleware(
    ILogger<AuditLoggingMiddleware> logger,
    ITenantContextAccessor? tenantContext = null) : IMiddleware
{
    private readonly ILogger<AuditLoggingMiddleware> _logger = logger;
    private readonly ITenantContextAccessor? _tenantContext = tenantContext;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var userId = ResolveUserId(context.User);
        using var _ = AuditActorContext.Use(userId);

        if (!ShouldAudit(context.Request.Path, context.Request.Method))
        {
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        await next(context);
        stopwatch.Stop();

        var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        var tenantId = TryTenantId();

        _logger.LogInformation(
            "AUDIT method={Method} path={Path} status={StatusCode} actor={ActorId} tenant={TenantId} trace={TraceId} elapsedMs={ElapsedMs}",
            context.Request.Method,
            context.Request.Path.Value ?? "/",
            context.Response.StatusCode,
            userId,
            tenantId,
            traceId,
            stopwatch.ElapsedMilliseconds);
    }

    private static bool ShouldAudit(PathString path, string method)
    {
        if (method == HttpMethods.Get
            || method == HttpMethods.Head
            || method == HttpMethods.Options
            || method == HttpMethods.Trace)
        {
            return false;
        }

        return !path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase)
               && !path.StartsWithSegments("/alive", StringComparison.OrdinalIgnoreCase)
               && !path.StartsWithSegments("/metrics", StringComparison.OrdinalIgnoreCase);
    }

    private static int? ResolveUserId(ClaimsPrincipal principal)
    {
        var raw = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? principal.FindFirstValue("sub");

        return int.TryParse(raw, out var userId) ? userId : null;
    }

    private string? TryTenantId()
    {
        try { return _tenantContext?.Current.Placement.TenantId.ToString("D"); }
        catch (InvalidOperationException) { return null; }
    }
}
