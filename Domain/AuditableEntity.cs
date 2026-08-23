using Domain.Interfaces;

namespace Domain;

public abstract class AuditableEntity : BaseEntity<int>, IAuditable
{
    public DateTime CreatedAt { get; set; }
    public int? CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedById { get; set; }
}
