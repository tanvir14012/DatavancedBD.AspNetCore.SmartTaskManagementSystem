using Domain;
using Infrastructure.Bootstrap;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Endpoints.User;

public sealed class Get : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users");

        group.MapGet("/{id:int}", GetUser)
            .WithName("GetUser")
            .WithSummary("Get a user by id")
            .Produces<Response>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> GetUser(
        int id,
        UserManager<AppUser> userManager,
        CancellationToken cancellationToken)
    {
        var user = await userManager.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return Results.NotFound();
        }

        var roles = await userManager.GetRolesAsync(user);
        return Results.Ok(new Response(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email ?? string.Empty,
            roles.FirstOrDefault() ?? "Team Member",
            user.LockoutEnd is null || user.LockoutEnd <= DateTime.UtcNow,
            user.CreatedAt));
    }
}

public sealed record Response(
    int Id,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt);
