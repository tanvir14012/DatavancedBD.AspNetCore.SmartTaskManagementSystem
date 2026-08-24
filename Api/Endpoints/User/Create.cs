using Domain;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.User;

public sealed class Create : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users");

        group.MapPost("/", CreateUser)
            .WithName("CreateUser")
            .WithSummary("Create a user")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> CreateUser(
        [FromBody] CreateUserRequest request,
        UserManager<AppUser> userManager)
    {
        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = ["First and last name are required."]
            });
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["email"] = ["A valid email is required."]
            });
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["password"] = ["Password must be at least 6 characters long."]
            });
        }

        var user = new AppUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            CreatedAt = DateTime.UtcNow,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return Results.ValidationProblem(result.Errors.GroupBy(error => error.Code).ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray()));
        }

        var normalizedRole = string.IsNullOrWhiteSpace(request.Role) ? "Team Member" : request.Role.Trim();
        if (Shared.Constants.Roles.Contains(normalizedRole))
        {
            await userManager.AddToRoleAsync(user, normalizedRole);
        }

        return Results.Created($"/api/users/{user.Id}", new Response(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email ?? string.Empty,
            normalizedRole,
            true,
            user.CreatedAt));
    }
}

public sealed record CreateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string Password,
    string? Role);
