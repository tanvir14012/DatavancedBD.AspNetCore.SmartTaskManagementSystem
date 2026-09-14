using Application.Tenancy;
using Application.Tenancy.Authorization;
using Application.Tenancy.Resolution;
using Microsoft.AspNetCore.Authorization;

namespace Api.Tenancy;

/// <summary>Authorizes the authenticated organization before publishing any scoped context.</summary>
public sealed class TenantAuthorizationHandler : AuthorizationHandler<TenantAccessRequirement>
{
    private readonly ITenantResolver _resolver;
    private readonly TenantContextAuthorizer _authorizer;
    private readonly ITenantContextInitializer _initializer;

    /// <summary>Captures scoped dependencies without I/O.</summary>
    public TenantAuthorizationHandler(ITenantResolver resolver, TenantContextAuthorizer authorizer,
        ITenantContextInitializer initializer)
    {
        _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
        _authorizer = authorizer ?? throw new ArgumentNullException(nameof(authorizer));
        _initializer = initializer ?? throw new ArgumentNullException(nameof(initializer));
    }

    /// <inheritdoc />
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, TenantAccessRequirement requirement)
    {
        // A route and its group can both require the same policy; establish the context only once.
        if (context.HasFailed || !context.PendingRequirements.Contains(requirement))
            return;
        if (context.Resource is not HttpContext http)
        {
            context.Fail();
            return;
        }

        http.RequestAborted.ThrowIfCancellationRequested();
        http.Response.Headers.CacheControl = "no-store";
        if (!TenantPrincipalAccess.TryRead(context.User, out var access))
        {
            context.Fail();
            return;
        }

        string? selector = null;
        if (http.Request.Headers.TryGetValue("X-Tenant-ID", out var selectors))
        {
            if (selectors.Count != 1)
            {
                context.Fail();
                return;
            }
            selector = selectors[0];
        }

        try
        {
            var organization = await _resolver.ResolveAsync(new TenantRequest(http.Request.Host.Value, selector),
                http.RequestAborted).ConfigureAwait(false);
            http.RequestAborted.ThrowIfCancellationRequested();
            if (organization != access!.TenantId)
            {
                context.Fail();
                return;
            }
            var authorized = await _authorizer.AuthorizeAsync(access, http.RequestAborted).ConfigureAwait(false);
            http.RequestAborted.ThrowIfCancellationRequested();
            _initializer.Initialize(authorized);
            context.Succeed(requirement);
        }
        catch (Exception exception) when (exception is TenantResolutionException or TenantAccessDeniedException)
        {
            http.RequestAborted.ThrowIfCancellationRequested();
            // Use framework challenge/forbid responses without exposing tenant existence or provider data.
            context.Fail();
        }
    }

}
