namespace Domain;

/// <summary>Base identity for persisted entities.</summary>
public abstract class BaseEntity<TId> where TId : struct
{
    /// <summary>The entity identifier within its storage boundary.</summary>
    public TId Id { get; set; }
}
