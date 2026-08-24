using Application.Interfaces;
using Domain;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.Auth;

public sealed class Register : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/register", RegisterUser)
            .WithName("RegisterUser")
            .WithSummary("Register a new user")
            .ProducesValidationProblem()
            .AllowAnonymous();
    }

    private static async Task<IResult> RegisterUser(
        [FromBody] RegisterRequest request,
        UserManager<AppUser> userManager,
        RoleManager<AppRole> roleManager,
        IAuthService authService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = ["Email and password are required."]
            });
        }

        var normalizedEmail = request.Email.Trim();
        if (await userManager.FindByEmailAsync(normalizedEmail) is not null)
        {
            return Results.Conflict(new { message = "A user with this email already exists." });
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
            var errors = createResult.Errors
                .GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

            return Results.ValidationProblem(errors);
        }

        await userManager.AddToRoleAsync(user, roleName);

        var tokens = await authService.CreateTokenPairAsync(user, cancellationToken);

        return Results.Ok(new
        {
            user = new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                role = roleName
            },
            accessToken = tokens.AccessToken,
            refreshToken = tokens.RefreshToken
        });
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

public sealed record RegisterRequest(
    string? FirstName,
    string? LastName,
    string Email,
    string Password,
    string? Role);
