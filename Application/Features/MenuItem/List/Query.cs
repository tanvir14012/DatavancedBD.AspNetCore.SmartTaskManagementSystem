using MediatR;

namespace Application.Features.MenuItem.List;

/// <summary>Input for the menuitem list query.</summary>
public sealed record Query : IRequest<Response>;
