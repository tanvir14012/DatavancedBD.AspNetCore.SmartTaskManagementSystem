using MediatR;

namespace Application.Features.Auth.RefreshToken;

/// <summary>Input for the auth refreshtoken command.</summary>
public sealed record Command(string? RefreshToken) : IRequest<Response?>;
