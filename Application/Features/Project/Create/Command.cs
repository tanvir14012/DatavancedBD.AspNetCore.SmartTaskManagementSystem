using MediatR;

namespace Application.Features.Project.Create;

/// <summary>Input for the project create command.</summary>
public sealed record Command(string Name, string? Description, DateOnly? StartDate, DateOnly? EndDate) : IRequest<Response>;
