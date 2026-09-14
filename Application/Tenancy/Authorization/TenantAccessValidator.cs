namespace Application.Tenancy.Authorization;

/// <summary>Validates active membership on every access decision without retaining local authorization state.</summary>
public sealed class TenantAccessValidator : ITenantAccessValidator
{
    private readonly ITenantMembershipReader _memberships;

    /// <summary>Captures a durable membership reader without I/O.</summary>
    public TenantAccessValidator(ITenantMembershipReader memberships)
        => _memberships = memberships ?? throw new ArgumentNullException(nameof(memberships));

    /// <inheritdoc />
    public async Task ValidateAsync(TenantAccess access, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        cancellationToken.ThrowIfCancellationRequested();
        bool active;
        try
        {
            active = await _memberships.IsActiveMemberAsync(access, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw;
        }
        cancellationToken.ThrowIfCancellationRequested();
        if (!active)
            throw new TenantAccessDeniedException();
    }
}
