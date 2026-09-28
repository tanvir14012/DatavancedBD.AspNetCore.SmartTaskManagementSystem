using MediatR;

namespace Application.Features.Auth.Register;

/// <summary>Input for the auth register command.</summary>
public sealed record Command(
    /// <summary>The user's given name.</summary>
    string? FirstName,
    /// <summary>The user's family name.</summary>
    string? LastName,
    /// <summary>The user's email address.</summary>
    string Email,
    /// <summary>The supplied password; treat this value as a secret.</summary>
    string Password,
    /// <summary>The application role requested for the user.</summary>
    string? Role) : IRequest<Response?>;
