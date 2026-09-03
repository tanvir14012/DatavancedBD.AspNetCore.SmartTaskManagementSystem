using Application.Interfaces;
using Api.Validators;
using Domain;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
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
        UserManager<AppUser> userManager,
        ICurrentUser currentUser,
        IHttpResponseCacheInvalidator httpCacheInvalidator)
    {
        var errors = new List<(string, string)>();

        // Validate FirstName
        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            errors.Add(("firstName", "First name is required."));
        }
        else if (request.FirstName.Length > ValidationHelper.MaxFirstNameLength)
        {
            errors.Add(("firstName", $"First name cannot exceed {ValidationHelper.MaxFirstNameLength} characters."));
        }

        // Validate LastName
        if (string.IsNullOrWhiteSpace(request.LastName))
        {
            errors.Add(("lastName", "Last name is required."));
        }
        else if (request.LastName.Length > ValidationHelper.MaxLastNameLength)
        {
            errors.Add(("lastName", $"Last name cannot exceed {ValidationHelper.MaxLastNameLength} characters."));
        }

        // Validate Email
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            errors.Add(("email", "Email is required."));
        }
        else if (!ValidationHelper.IsValidEmail(request.Email))
        {
            errors.Add(("email", "Email must be a valid email address."));
        }

        // Validate Password
        if (string.IsNullOrWhiteSpace(request.Password))
        {
            errors.Add(("password", "Password is required."));
        }
        else if (request.Password.Length < ValidationHelper.MinPasswordLength)
        {
            errors.Add(("password", $"Password must be at least {ValidationHelper.MinPasswordLength} characters long."));
        }
        else if (!ValidationHelper.IsStrongPassword(request.Password))
        {
            errors.Add(("password", "Password must contain uppercase, lowercase, digit, and special character (!@#$%^&*)."));
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(ValidationHelper.CreateValidationProblem(errors.ToArray()));
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

        await httpCacheInvalidator.InvalidateByRouteAsync("/api/users", currentUser.UserId?.ToString());

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
