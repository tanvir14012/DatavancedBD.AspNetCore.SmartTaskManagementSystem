using MediatR;

namespace Application.Features.Project.Delete;

/// <summary>Input for the project delete command.</summary>
public sealed record Command(int Id) : IRequest<Response>;
