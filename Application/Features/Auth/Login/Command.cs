using MediatR;

namespace Application.Features.Auth.Login;

public sealed record Command(string Email, string Password) : IRequest<Response?>;
