namespace Domain.Interfaces;

/// <summary>Identifies the tenant boundary owning a value.</summary>
public interface IMultiTenant
{
    /// <summary>The identifier of the owning tenant.</summary>
    Guid TenantId { get; }
}
