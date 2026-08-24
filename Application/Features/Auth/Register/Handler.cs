using Application.Interfaces;
using Domain;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace Application.Features.Auth.Register;

public sealed class Handler(
    UserManager<AppUser> userManager,
    RoleManager<AppRole> roleManager,
    IAuthService authService)
    : IRequestHandler<Command, Response?>
{
    public async Task<Response?> Handle(Command request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return null;
        }

        var normalizedEmail = request.Email.Trim();
        if (await userManager.FindByEmailAsync(normalizedEmail) is not null)
        {
            return null;
        }

        var roleName = NormalizeRole(request.Role ?? "Team Member");
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new AppRole(roleName));
        }

        var user = new AppUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FirstName = request.FirstName?.Trim() ?? string.Empty,
            LastName = request.LastName?.Trim() ?? string.Empty
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return null;
        }

        await userManager.AddToRoleAsync(user, roleName);

        var tokens = await authService.CreateTokenPairAsync(user, cancellationToken);

        return new Response(
            new UserSummary(
                user.Id,
                user.Email ?? string.Empty,
                user.FirstName,
                user.LastName,
                roleName),
            tokens.AccessToken,
            tokens.RefreshToken);
    }

    private static string NormalizeRole(string role)
    {
        return role.Trim() switch
        {
            "Admin" => "Admin",
            "Project Manager" or "ProjectManager" or "project-manager" => "Project Manager",
            "Team Member" or "TeamMember" or "team-member" or "Member" => "Team Member",
            _ => "Team Member"
        };
    }
}
