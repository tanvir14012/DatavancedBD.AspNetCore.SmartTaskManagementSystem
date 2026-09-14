namespace Application.Tenancy;

/// <summary>
/// Signals a classified cache transport outage or timeout for which a durable catalog lookup
/// is appropriate. Adapters must not wrap cancellation, corrupt data or programming errors.
/// </summary>
public sealed class TenantPlacementCacheUnavailableException : Exception
{
    /// <summary>Creates a provider-neutral failure, optionally retaining the transport cause.</summary>
    public TenantPlacementCacheUnavailableException(Exception? innerException = null)
        : base("The tenant placement cache is unavailable.", innerException)
    {
    }
}
