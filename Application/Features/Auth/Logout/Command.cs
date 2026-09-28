using MediatR;

namespace Application.Features.Auth.Logout;

/// <summary>Input for the auth logout command.</summary>
public sealed record Command(string? RefreshToken) : IRequest<Response>;
