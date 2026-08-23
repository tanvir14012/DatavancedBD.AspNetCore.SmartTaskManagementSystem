using Domain.Interfaces;

namespace Domain;

public sealed class Project : AuditableEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }

    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public bool IsArchived { get; set; }

    public AppUser CreatedBy { get; set; } = default!;

    public bool IsDeleted { get; set; }

    public ICollection<UserProject> Members { get; set; } = [];
}
