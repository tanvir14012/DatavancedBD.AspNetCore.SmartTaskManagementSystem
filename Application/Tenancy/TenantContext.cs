namespace Application.Tenancy;

/// <summary>An immutable organization and subject for one request or background job.</summary>
/// <remarks>
/// Construction requires an active snapshot but does not establish membership or freshness.
/// The boundary must authenticate the subject and validate organization access before publishing it.
/// </remarks>
public sealed record TenantContext
{
    /// <summary>Creates a structurally valid context without I/O.</summary>
    public TenantContext(TenantPlacement placement, string subjectId)
    {
        ArgumentNullException.ThrowIfNull(placement);
        ArgumentException.ThrowIfNullOrWhiteSpace(subjectId);
        if (placement.Lifecycle != TenantLifecycle.Active)
            throw new ArgumentException("Tenant context requires an active placement.", nameof(placement));

        Placement = placement;
        SubjectId = subjectId;
    }

    /// <summary>The active placement snapshot selected for this scope.</summary>
    public TenantPlacement Placement { get; }

    /// <summary>The authenticated subject identifier, preserved without normalization.</summary>
    public string SubjectId { get; }
}
