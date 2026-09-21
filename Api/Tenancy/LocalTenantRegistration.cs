using Application.Interfaces;
using Application.Tenancy;
using Domain;
using Infrastructure.Data.EfCore.Persistence;
using Infrastructure.Tenancy.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Api.Tenancy;

public static class LocalTenantRegistration
{
    public static void AddLocalTenant(this WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsEnvironment("LocalDocker")) return;
        var binding = new LocalTenantBinding(builder.Configuration);
        builder.Services.AddSingleton(binding);
        builder.Services.AddScoped<ITenantContextAccessor>(_ => binding);
        builder.Services.AddScoped<ITenantCacheKeyBuilder, Infrastructure.Caching.Keys.TenantCacheKeyBuilder>();
        builder.Services.AddScoped<AppDbContext>(_ => binding.CreateContext());
        builder.Services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        builder.Services.AddScoped<IUserStore<AppUser>, TenantUserStore>();
        builder.Services.AddScoped<IRoleStore<AppRole>, TenantRoleStore>();
        builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Events.OnTokenValidated = context =>
            {
                if (context.Principal?.FindFirst("tenant_id")?.Value != binding.Current.Placement.TenantId.ToString("D"))
                    context.Fail("Token belongs to another company.");
                return Task.CompletedTask;
            };
        });
        builder.Services.AddHealthChecks().AddCheck<LocalTenantHealthCheck>("tenant-storage");
    }
}

public sealed class LocalTenantHealthCheck(LocalTenantBinding binding) : Microsoft.Extensions.Diagnostics.HealthChecks.IHealthCheck
{
    public async Task<Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult> CheckHealthAsync(
        Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        await using var db = binding.CreateContext();
        await db.Users.AnyAsync(cancellationToken);
        return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy();
    }
}
