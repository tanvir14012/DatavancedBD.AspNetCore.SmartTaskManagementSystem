namespace Infrastructure.Tenancy.Migrations;

public sealed class TenantMigrationOptions
{
    public const string SectionName = "Saas:Migration";
    public int MaxConcurrency { get; set; } = 2;
}
