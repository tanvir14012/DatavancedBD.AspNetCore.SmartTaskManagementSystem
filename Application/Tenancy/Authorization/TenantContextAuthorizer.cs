namespace Application.Tenancy.Authorization;

/// <summary>Creates an active context only after membership and authoritative placement checks succeed.</summary>
/// <remarks>In-flight revocation/relocation still requires transaction-time fencing in persistence.</remarks>
public sealed class TenantContextAuthorizer
{
    private readonly ITenantAccessValidator _access;
    private readonly IAuthoritativeTenantCatalog _catalog;

    /// <summary>Captures dependencies without I/O or a tenant-specific lifetime.</summary>
    public TenantContextAuthorizer(ITenantAccessValidator access, IAuthoritativeTenantCatalog catalog)
    {
        _access = access ?? throw new ArgumentNullException(nameof(access));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
    }

    /// <summary>Authorizes an authenticated identity. Callers publish the result once in their scope.</summary>
    public async Task<TenantContext> AuthorizeAsync(TenantAccess access, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            // Do not reveal placement/existence or consume catalog capacity for nonmembers.
            await _access.ValidateAsync(access, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            var placement = await _catalog.FindAsync(access.TenantId, cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            if (placement is null)
                throw new TenantAccessDeniedException();
            if (placement.TenantId != access.TenantId)
                throw new InvalidDataException("The authoritative catalog returned a different organization.");
            if (placement.Lifecycle != TenantLifecycle.Active)
                throw new TenantAccessDeniedException();
            return new TenantContext(placement, access.SubjectId, access.Issuer);
        }
        catch
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw;
        }
    }
}
