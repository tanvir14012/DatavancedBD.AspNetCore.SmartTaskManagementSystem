namespace Domain.Interfaces;

public interface IAuditable
{
    DateTime CreatedAt { get; set; }
    DateTime? UpdatedAt { get; set; }

    int? CreatedById { get; set; }
    int? UpdatedById { get; set; }
}
