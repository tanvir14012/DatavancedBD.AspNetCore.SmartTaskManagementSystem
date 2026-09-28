using MediatR;

namespace Application.Features.Task.Delete;

/// <summary>Input for the task delete command.</summary>
public sealed record Command(int Id) : IRequest<Response>;
