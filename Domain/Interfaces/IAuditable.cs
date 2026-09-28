namespace Domain.Interfaces;

/// <summary>Creation and last-update metadata for an entity.</summary>
public interface IAuditable
{
    /// <summary>The UTC instant at which the record was created.</summary>
    DateTime CreatedAt { get; set; }
    /// <summary>The UTC instant of the last update, when recorded.</summary>
    DateTime? UpdatedAt { get; set; }

    /// <summary>The creating user's identifier, when known.</summary>
    int? CreatedById { get; set; }
    /// <summary>The last updating user's identifier, when known.</summary>
    int? UpdatedById { get; set; }
}
