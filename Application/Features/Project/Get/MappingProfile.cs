using AutoMapper;

namespace Application.Features.Project.Get;

public sealed class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Domain.Project, Response>();
    }
}
