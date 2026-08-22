namespace Infrastructure.Data.EfCore.Models;

public abstract class BaseEntity<TId> where TId : struct
{
    public TId Id { get; protected set; }
}
