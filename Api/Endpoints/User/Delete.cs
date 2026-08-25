using Domain;
using Infrastructure.Bootstrap;
using Infrastructure.Caching.Abstractions;
using Microsoft.AspNetCore.Identity;

namespace Api.Endpoints.User;

public sealed class Delete : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users");

        group.MapDelete("/{id:int}", DeleteUser)
            .WithName("DeleteUser")
            .WithSummary("Delete a user")
            .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }

    private static async Task<IResult> DeleteUser(int id, UserManager<AppUser> userManager, IHttpResponseCacheInvalidator httpCacheInvalidator)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null)
        {
            return Results.NotFound();
        }

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            return Results.ValidationProblem(result.Errors.GroupBy(error => error.Code).ToDictionary(
                group => group.Key,
                group => group.Select(error => error.Description).ToArray()));
        }

        await httpCacheInvalidator.InvalidateByRouteAsync("/api/users");

        return Results.NoContent();
    }
}
