namespace Domain.Interfaces;

/// <summary>Marks records retained in storage but hidden from ordinary reads.</summary>
public interface ISoftDeletable
{
    /// <summary>Whether the record has been soft-deleted.</summary>
    bool IsDeleted { get; }
}
