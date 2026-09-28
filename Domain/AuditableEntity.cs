using Domain.Interfaces;

namespace Domain;

/// <summary>Base entity that records creation and last-update metadata.</summary>
public abstract class AuditableEntity : BaseEntity<int>, IAuditable
{
    /// <summary>The UTC instant at which the record was created.</summary>
    public DateTime CreatedAt { get; set; }
    /// <summary>The creating user's identifier, when known.</summary>
    public int? CreatedById { get; set; }
    /// <summary>The UTC instant of the last update, when recorded.</summary>
    public DateTime? UpdatedAt { get; set; }
    /// <summary>The last updating user's identifier, when known.</summary>
    public int? UpdatedById { get; set; }
}
