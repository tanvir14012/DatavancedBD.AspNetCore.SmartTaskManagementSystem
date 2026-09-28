using Domain.Interfaces;

namespace Domain;

/// <summary>A project grouping member access and task work.</summary>
public sealed class Project : AuditableEntity, ISoftDeletable
{
    /// <summary>The display name.</summary>
    public string Name { get; set; } = default!;
    /// <summary>The optional descriptive text.</summary>
    public string? Description { get; set; }

    /// <summary>The optional planned project start date.</summary>
    public DateOnly? StartDate { get; set; }
    /// <summary>The optional planned project end date.</summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>Whether the project has been archived.</summary>
    public bool IsArchived { get; set; }

    /// <summary>The user who created this record.</summary>
    public AppUser CreatedBy { get; set; } = default!;

    /// <summary>Whether the record has been soft-deleted.</summary>
    public bool IsDeleted { get; set; }

    /// <summary>Users assigned membership in this project.</summary>
    public ICollection<UserProject> Members { get; set; } = [];
}
