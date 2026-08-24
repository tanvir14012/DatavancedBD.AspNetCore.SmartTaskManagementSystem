using MediatR;

namespace Application.Features.Auth.Register;

public sealed record Command(
    string? FirstName,
    string? LastName,
    string Email,
    string Password,
    string? Role) : IRequest<Response?>;
