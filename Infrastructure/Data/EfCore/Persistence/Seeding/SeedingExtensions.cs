using Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Data.EfCore.Persistence.Seeding;

public static class SeedingExtensions
{
    /// <summary>
    /// Creates the application roles without provisioning shared default accounts.
    /// User accounts must be created through the application or an explicitly controlled
    /// bootstrap process; production deployments must never receive known credentials.
    /// </summary>
    public static async Task SeedRolesAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();

        foreach (var role in Shared.Constants.Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var result = await roleManager.CreateAsync(new AppRole(role));
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Could not create role '{role}': {string.Join(", ", result.Errors.Select(error => error.Description))}");
                }
            }
        }
    }
}
