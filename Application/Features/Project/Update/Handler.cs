using Application.Interfaces;
using Application.Models;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Project.Update;

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
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == request.Id && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.Id} not found.");
        }

        var canEdit = currentUser.IsInRole("Admin") ||
            project.Members.Any(m => m.UserId == currentUser.UserId && (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!canEdit)
        {
            throw new UnauthorizedAccessException("User does not have permission to update this project.");
        }

        project.Name = request.Name.Trim();
        project.Description = request.Description?.Trim();
        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        project.IsArchived = request.IsArchived;
        project.UpdatedAt = DateTime.UtcNow;
        project.UpdatedById = currentUser.UserId;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cacheService.RemoveByPatternAsync("projects:list:*", cancellationToken);
        await cacheService.RemoveAsync($"ef:{nameof(Domain.Project)}:{request.Id}", cancellationToken);

        var members = await dbContext.UserProjects
            .AsNoTracking()
            .Where(x => x.ProjectId == request.Id)
            .Select(x => new ProjectMemberSummary(
                x.UserId,
                x.User.UserName ?? x.User.Email ?? string.Empty,
                x.User.Email ?? string.Empty,
                x.ProjectRole))
            .ToListAsync(cancellationToken);

        return new Response(
            project.Id,
            project.Name,
            project.Description,
            project.StartDate,
            project.EndDate,
            project.CreatedAt,
            currentUser.IsInRole("Admin") || members.Any(x => x.UserId == currentUser.UserId && (x.Role == ProjectRole.Manager || x.Role == ProjectRole.Owner)),
            currentUser.IsInRole("Admin"),
            members);
    }
}
