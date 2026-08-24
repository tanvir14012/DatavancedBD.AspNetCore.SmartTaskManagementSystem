using System.Security.Claims;
using Application.Interfaces;
using Infrastructure.AssemblyScan;

namespace Api.Services;

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser, IScopedService
{
    private ClaimsPrincipal? User => accessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public int? UserId =>
        int.TryParse(
            User?.FindFirstValue(ClaimTypes.NameIdentifier),
            out var id)
            ? id
            : null;

    public string? UserName => User?.FindFirstValue(ClaimTypes.Name);

    public string? Email => User?.FindFirstValue(ClaimTypes.Email);

    public IReadOnlyCollection<string> Roles =>
        User?
            .FindAll(ClaimTypes.Role)
            .Select(x => x.Value)
            .ToArray()
        ?? [];

    public bool IsInRole(string role) => User?.IsInRole(role) ?? false;
}
