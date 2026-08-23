namespace Domain.Interfaces;

public interface IMultiTenant
{
    Guid TenantId { get; }
}

