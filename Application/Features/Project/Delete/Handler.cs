using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Project.Delete;

public sealed class Handler(IAppDbContext dbContext, ICurrentUser currentUser, ICacheService cacheService)
    : IRequestHandler<Command, Response>
{
    public async Task<Response> Handle(Command request, CancellationToken cancellationToken)
    {
        if (!currentUser.IsAuthenticated || !currentUser.UserId.HasValue)
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }

        var project = await dbContext.Projects
            .SingleOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.Id} not found.");
        }

        if (!currentUser.IsInRole("Admin"))
        {
            throw new UnauthorizedAccessException("Only administrators can delete projects.");
        }

        project.IsDeleted = true;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("projects:list:*", cancellationToken);
        await cacheService.RemoveAsync($"ef:{nameof(Domain.Project)}:{request.Id}", cancellationToken);

        return new Response(true, project.Id);
    }
}
