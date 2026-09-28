using MediatR;

namespace Application.Features.Auth.Login;

/// <summary>Input for the auth login command.</summary>
public sealed record Command(string Email, string Password) : IRequest<Response?>;
