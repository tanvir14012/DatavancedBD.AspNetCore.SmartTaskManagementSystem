using Application.Interfaces;
using Domain;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Api.Endpoints.User;

public sealed class Update : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users");

        group.MapPut("/{id:int}", UpdateUser)
            .WithName("UpdateUser")
            .WithSummary("Update a user")
            .ProducesValidationProblem()
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> UpdateUser(
        int id,
        [FromBody] UpdateUserRequest request,
        UserManager<AppUser> userManager,
        ICurrentUser currentUser,
        IHttpResponseCacheInvalidator httpCacheInvalidator)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return Results.NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = ["First and last name are required."]
            });
        }

        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.Email = request.Email.Trim();
        user.UserName = request.Email.Trim();
        user.UpdatedAt = DateTime.UtcNow;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return Results.ValidationProblem(result.Errors.GroupBy(error => error.Code).ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray()));
        }

        var currentRoles = await userManager.GetRolesAsync(user);
        if (currentRoles.Count > 0)
        {
            await userManager.RemoveFromRolesAsync(user, currentRoles);
        }

        if (!string.IsNullOrWhiteSpace(request.Role) && Shared.Constants.Roles.Contains(request.Role.Trim()))
        {
            await userManager.AddToRoleAsync(user, request.Role.Trim());
        }

        await httpCacheInvalidator.InvalidateByRouteAsync("/api/users", currentUser.UserId?.ToString());

        var role = (await userManager.GetRolesAsync(user)).FirstOrDefault() ?? "Team Member";
        return Results.Ok(new Response(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email ?? string.Empty,
            role,
            user.LockoutEnd is null || user.LockoutEnd <= DateTime.UtcNow,
            user.UpdatedAt ?? user.CreatedAt));
    }
}

public sealed record UpdateUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Role);
