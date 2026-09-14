namespace Application.Tenancy.Resolution;

/// <summary>Reasons untrusted request routing context can be rejected.</summary>
public enum TenantResolutionFailure
{
    /// <summary>The required request authority is absent or malformed.</summary>
    InvalidHost,
    /// <summary>A supplied selector is not a nonempty, exact D-format organization identifier.</summary>
    InvalidSelector,
    /// <summary>A shared API authority requires an explicit organization selector.</summary>
    MissingSelector,
    /// <summary>The authority has no approved organization mapping.</summary>
    UnknownHost,
    /// <summary>The selector conflicts with the authority's organization mapping.</summary>
    ConflictingSelector
}

/// <summary>Rejects routing context without retaining or exposing raw client input.</summary>
public sealed class TenantResolutionException : Exception
{
    /// <summary>Creates a rejection with a fixed, safe message for the supplied reason.</summary>
    public TenantResolutionException(TenantResolutionFailure failure) : base(MessageFor(failure))
    {
        Failure = failure;
    }

    /// <summary>The structured rejection reason, independent of HTTP response mapping.</summary>
    public TenantResolutionFailure Failure { get; }

    private static string MessageFor(TenantResolutionFailure failure) => failure switch
    {
        TenantResolutionFailure.InvalidHost => "A valid request authority is required for tenant resolution.",
        TenantResolutionFailure.InvalidSelector => "The tenant selector is invalid.",
        TenantResolutionFailure.MissingSelector => "This request authority requires a tenant selector.",
        TenantResolutionFailure.UnknownHost => "The request authority has no approved tenant mapping.",
        TenantResolutionFailure.ConflictingSelector => "The tenant selector conflicts with the request authority.",
        _ => throw new ArgumentOutOfRangeException(nameof(failure))
    };
}
