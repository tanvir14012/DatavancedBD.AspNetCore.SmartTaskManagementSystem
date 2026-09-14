namespace Application.Tenancy;

/// <summary>An organization and issuer-qualified authenticated subject to check for membership.</summary>
public sealed record TenantAccess
{
    /// <summary>Validates structural identity without authenticating or authorizing it.</summary>
    public TenantAccess(Guid tenantId, string subjectId, string issuer)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Organization identity must not be empty.", nameof(tenantId));
        ValidateIdentityPart(subjectId, nameof(subjectId));
        ValidateIdentityPart(issuer, nameof(issuer));
        TenantId = tenantId;
        SubjectId = subjectId;
        Issuer = issuer;
    }

    /// <summary>The purchasing organization.</summary>
    public Guid TenantId { get; }
    /// <summary>Opaque, case-sensitive subject from the validated authentication ticket.</summary>
    public string SubjectId { get; }
    /// <summary>Exact validated issuer; the same subject from a different issuer is a different identity.</summary>
    public string Issuer { get; }

    internal static void ValidateIdentityPart(string value, string name)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value, name);
        if (value.Length > 256 || value.Trim() != value || value.Any(char.IsControl))
            throw new ArgumentException("Identity value must contain at most 256 characters without boundary whitespace or controls.", name);
    }
}
