using Application.Interfaces;
using AutoMapper;
using MediatR;

namespace Application.Features.Project.Create;

public sealed class Handler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IMapper mapper,
    ICacheService cache)
    : IRequestHandler<Command, Response>
{
    public async Task<Response> Handle(
        Command request,
        CancellationToken cancellationToken)
    {
        var project = mapper.Map<Domain.Project>(request);

        project.CreatedById = currentUser.UserId;
        project.CreatedAt = DateTime.UtcNow;

        db.Projects.Add(project);

        if (currentUser.UserId.HasValue)
        {
           project.Members.Add(new Domain.UserProject
           {
               UserId = currentUser.UserId.Value,
               ProjectRole = Domain.Enums.ProjectRole.Owner,
               JoinedAt = DateTime.UtcNow,
               Project = project
           });
        }

        await db.SaveChangesAsync(cancellationToken);

        var response = mapper.Map<Response>(project);

        await cache.SetAsync(
           $"ef:{nameof(Domain.Project)}:{project.Id}",
           response,
           cancellationToken: cancellationToken);

        return response;
    }
}
