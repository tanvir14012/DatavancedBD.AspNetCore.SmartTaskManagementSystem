using Microsoft.AspNetCore.Routing;

namespace Infrastructure.Bootstrap;

public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder app);
}
