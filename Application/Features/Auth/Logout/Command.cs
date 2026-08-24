using MediatR;

namespace Application.Features.Auth.Logout;

public sealed record Command(string? RefreshToken) : IRequest<Response>;
