namespace Infrastructure.Data.EfCore.Persistence;

public interface IAppDbContext
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
