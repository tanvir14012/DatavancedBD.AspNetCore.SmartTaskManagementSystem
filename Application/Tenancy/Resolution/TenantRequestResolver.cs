namespace Application.Tenancy.Resolution;

/// <summary>Resolves an untrusted request to a candidate organization without authorizing its caller.</summary>
/// <remarks>
/// The HTTP boundary must validate forwarded-host provenance before supplying Host. Shared API
/// authorities require a selector; all other authorities require an exact external directory mapping.
/// Authentication, membership, placement lifecycle, and region validation follow resolution separately.
/// </remarks>
public sealed class TenantRequestResolver : ITenantResolver
{
    private readonly ITenantHostDirectory _directory;
    private readonly TenantResolutionOptions _options;

    /// <summary>Creates a resolver without performing directory I/O.</summary>
    public TenantRequestResolver(ITenantHostDirectory directory, TenantResolutionOptions options)
    {
        ArgumentNullException.ThrowIfNull(directory);
        ArgumentNullException.ThrowIfNull(options);
        _directory = directory;
        _options = options;
    }

    /// <inheritdoc />
    public async Task<Guid> ResolveAsync(TenantRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();
        if (!TenantAuthority.TryNormalize(request.Host, out var authority))
            throw new TenantResolutionException(TenantResolutionFailure.InvalidHost);

        Guid? selector = null;
        if (request.TenantSelector is not null)
        {
            // TryParseExact permits surrounding whitespace, so enforce the canonical D length too.
            if (request.TenantSelector.Length != 36 ||
                !Guid.TryParseExact(request.TenantSelector, "D", out var parsed) || parsed == Guid.Empty)
                throw new TenantResolutionException(TenantResolutionFailure.InvalidSelector);
            selector = parsed;
        }

        if (_options.SharedApiAuthorities.Contains(authority))
        {
            cancellationToken.ThrowIfCancellationRequested();
            return selector ?? throw new TenantResolutionException(TenantResolutionFailure.MissingSelector);
        }

        cancellationToken.ThrowIfCancellationRequested();
        Guid? organization;
        try
        {
            organization = await _directory.FindTenantAsync(authority, cancellationToken).ConfigureAwait(false);
        }
        catch
        {
            // A dependency failure never supplies an alternate route; caller cancellation wins.
            cancellationToken.ThrowIfCancellationRequested();
            throw;
        }
        cancellationToken.ThrowIfCancellationRequested();

        if (organization is null)
            throw new TenantResolutionException(TenantResolutionFailure.UnknownHost);
        if (organization == Guid.Empty)
            throw new InvalidDataException("The tenant host directory returned an empty organization identity.");
        if (selector.HasValue && selector.Value != organization.Value)
            throw new TenantResolutionException(TenantResolutionFailure.ConflictingSelector);

        return organization.Value;
    }
}
