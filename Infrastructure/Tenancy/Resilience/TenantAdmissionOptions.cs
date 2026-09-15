namespace Infrastructure.Tenancy.Resilience;

public sealed class TenantAdmissionOptions
{
    public const string SectionName = "Saas:Resilience";
    public int MaxConcurrentWork { get; set; } = 32;
    public int MaxConcurrentPerTenant { get; set; } = 4;
    public int MaxConcurrentPerTarget { get; set; } = 16;
    public int WaitMilliseconds { get; set; } = 250;

    public void Validate()
    {
        if (MaxConcurrentWork is < 1 or > 512)
            throw new ArgumentOutOfRangeException(nameof(MaxConcurrentWork));
        if (MaxConcurrentPerTenant is < 1 or > 64)
            throw new ArgumentOutOfRangeException(nameof(MaxConcurrentPerTenant));
        if (MaxConcurrentPerTarget is < 1 or > 256)
            throw new ArgumentOutOfRangeException(nameof(MaxConcurrentPerTarget));
        if (WaitMilliseconds is < 0 or > 60_000)
            throw new ArgumentOutOfRangeException(nameof(WaitMilliseconds));
    }
}
