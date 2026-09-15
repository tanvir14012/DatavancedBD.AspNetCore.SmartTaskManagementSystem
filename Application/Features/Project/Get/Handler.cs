using Application.Interfaces;
using Application.Tenancy;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Project.Get;

public sealed class Handler(IAppDbContext dbContext, ICacheService cacheService,
    ITenantCacheKeyBuilder? tenantKeys = null)
    : IRequestHandler<Query, Response>
{
    public async Task<Response> Handle(Query request, CancellationToken cancellationToken)
    {
        var cacheKey = $"ef:{nameof(Domain.Project)}:{request.Id}";

        cacheKey = tenantKeys?.Build(cacheKey) ?? cacheKey;
        var cached = await cacheService.GetAsync<Response>(cacheKey, cancellationToken);

        if (cached is not null)
            return cached;

        var project = await dbContext.Projects
            .AsNoTracking()
            .Where(x => x.Id == request.Id)
            .Select(x => new Response(
                x.Id,
                x.Name,
                x.Description,
                x.StartDate,
                x.EndDate,
                x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        if (project is null)
            throw new KeyNotFoundException($"Project {request.Id} not found");

        await cacheService.SetAsync(cacheKey, project, cancellationToken: cancellationToken);

        return project;
    }
}
