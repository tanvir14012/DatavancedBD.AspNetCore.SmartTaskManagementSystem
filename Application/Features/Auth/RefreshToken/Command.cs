using MediatR;

namespace Application.Features.Auth.RefreshToken;

public sealed record Command(string? RefreshToken) : IRequest<Response?>;
