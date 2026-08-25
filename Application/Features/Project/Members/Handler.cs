using Application.Interfaces;
using Domain;
using Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Project.Members;

public sealed class AssignmentsHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<AssignmentsQuery, AssignmentsResponse>
{
    public async Task<AssignmentsResponse> Handle(AssignmentsQuery request, CancellationToken cancellationToken)
    {
        var query = dbContext.UserProjects
            .AsNoTracking()
            .Include(x => x.Project)
            .Include(x => x.User)
            .AsQueryable();

        if (!currentUser.IsInRole("Admin"))
        {
            query = query.Where(x => x.Project.Members.Any(member =>
                member.UserId == currentUser.UserId &&
                (member.ProjectRole == ProjectRole.Manager || member.ProjectRole == ProjectRole.Owner)));
        }

        if (request.ProjectId.HasValue)
        {
            query = query.Where(x => x.ProjectId == request.ProjectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var searchTerm = request.Search.Trim();
            query = query.Where(x =>
                x.Project.Name.Contains(searchTerm) ||
                (x.User.UserName != null && x.User.UserName.Contains(searchTerm)) ||
                (x.User.Email != null && x.User.Email.Contains(searchTerm)));
        }

        if (!string.IsNullOrWhiteSpace(request.Role) && !string.Equals(request.Role, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<ProjectRole>(request.Role, true, out var parsedRole))
            {
                query = query.Where(x => x.ProjectRole == parsedRole);
            }
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var pageSize = Math.Max(request.Length, 1);
        var start = Math.Max(request.Start, 0);

        var assignments = await query
            .OrderBy(x => x.Project.Name)
            .ThenBy(x => x.User.UserName ?? x.User.Email)
            .Skip(start)
            .Take(pageSize)
            .Select(x => new ProjectAssignmentSummary(
                x.ProjectId,
                x.Project.Name,
                x.UserId,
                x.User.UserName ?? x.User.Email ?? string.Empty,
                x.User.Email ?? string.Empty,
                x.ProjectRole))
            .ToListAsync(cancellationToken);

        return new AssignmentsResponse(
            (start / pageSize) + 1,
            pageSize,
            totalCount,
            totalCount,
            (int)Math.Ceiling(totalCount / (double)pageSize),
            assignments);
    }
}

public sealed class MembersHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<MembersQuery, IReadOnlyList<ProjectMemberSummary>>
{
    public async Task<IReadOnlyList<ProjectMemberSummary>> Handle(MembersQuery request, CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .AsNoTracking()
            .SingleOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.ProjectId} not found.");
        }

        var isAllowed = currentUser.IsInRole("Admin") ||
            await dbContext.UserProjects.AnyAsync(x => x.ProjectId == request.ProjectId && x.UserId == currentUser.UserId, cancellationToken);

        if (!isAllowed)
        {
            throw new UnauthorizedAccessException("User does not have access to this project.");
        }

        return await dbContext.UserProjects
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => x.ProjectId == request.ProjectId)
            .OrderBy(x => x.ProjectRole)
            .ThenBy(x => x.User.UserName ?? x.User.Email)
            .Select(x => new ProjectMemberSummary(
                x.UserId,
                x.User.UserName ?? x.User.Email ?? string.Empty,
                x.User.Email ?? string.Empty,
                x.ProjectRole))
            .ToListAsync(cancellationToken);
    }
}

public sealed class AssignHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<AssignCommand, AssignResult>
{
    public async Task<AssignResult> Handle(AssignCommand request, CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.ProjectId} not found.");
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = !isAdmin && project.Members.Any(m =>
            m.UserId == currentUser.UserId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            throw new UnauthorizedAccessException("User does not have permission to assign project members.");
        }

        if (!Enum.TryParse<ProjectRole>(request.Role, true, out var parsedRole))
        {
            throw new ValidationException(new[] { new FluentValidation.Results.ValidationFailure(nameof(request.Role), "Invalid role. Must be one of: Owner, Manager, Member, Viewer") });
        }

        if (!isAdmin && parsedRole == ProjectRole.Manager)
        {
            throw new UnauthorizedAccessException("Only admins may assign a Manager role.");
        }

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == request.UserId, cancellationToken);
        if (!userExists)
        {
            throw new KeyNotFoundException($"User {request.UserId} not found.");
        }

        var currentMembership = await dbContext.UserProjects
            .SingleOrDefaultAsync(x => x.ProjectId == request.ProjectId && x.UserId == request.UserId, cancellationToken);

        if (currentMembership is null)
        {
            dbContext.UserProjects.Add(new UserProject
            {
                ProjectId = request.ProjectId,
                UserId = request.UserId,
                ProjectRole = parsedRole,
                JoinedAt = DateTime.UtcNow
            });
        }
        else
        {
            currentMembership.ProjectRole = parsedRole;
            currentMembership.JoinedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new AssignResult(request.ProjectId, request.UserId, parsedRole);
    }
}

public sealed class RemoveHandler(IAppDbContext dbContext, ICurrentUser currentUser)
    : IRequestHandler<RemoveCommand, bool>
{
    public async Task<bool> Handle(RemoveCommand request, CancellationToken cancellationToken)
    {
        var project = await dbContext.Projects
            .Include(p => p.Members)
            .SingleOrDefaultAsync(p => p.Id == request.ProjectId && !p.IsDeleted, cancellationToken);

        if (project is null)
        {
            throw new KeyNotFoundException($"Project {request.ProjectId} not found.");
        }

        var isAdmin = currentUser.IsInRole("Admin");
        var isProjectManager = !isAdmin && project.Members.Any(m =>
            m.UserId == currentUser.UserId &&
            (m.ProjectRole == ProjectRole.Manager || m.ProjectRole == ProjectRole.Owner));

        if (!isAdmin && !isProjectManager)
        {
            throw new UnauthorizedAccessException("User does not have permission to remove project members.");
        }

        var membership = await dbContext.UserProjects
            .SingleOrDefaultAsync(x => x.ProjectId == request.ProjectId && x.UserId == request.UserId, cancellationToken);

        if (membership is null)
        {
            throw new KeyNotFoundException("Project member not found.");
        }

        dbContext.UserProjects.Remove(membership);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
