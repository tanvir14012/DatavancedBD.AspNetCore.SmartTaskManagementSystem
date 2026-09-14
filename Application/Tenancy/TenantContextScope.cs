namespace Application.Tenancy;

/// <summary>Stores exactly one tenant context per dependency injection scope.</summary>
/// <remarks>
/// Register once as scoped, with both interfaces resolving the same instance. Never register as a
/// singleton or reuse across jobs. No static or ambient state flows into unrelated work; a worker
/// creates a fresh scope and establishes its own context after revalidation.
/// </remarks>
public sealed class TenantContextScope : ITenantContextAccessor, ITenantContextInitializer
{
    private TenantContext? _current;

    /// <inheritdoc />
    public TenantContext Current => Volatile.Read(ref _current)
        ?? throw new InvalidOperationException("Tenant context has not been established for this scope.");

    /// <inheritdoc />
    public void Initialize(TenantContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (Interlocked.CompareExchange(ref _current, context, null) is not null)
            throw new InvalidOperationException("Tenant context is already established for this scope.");
    }
}
