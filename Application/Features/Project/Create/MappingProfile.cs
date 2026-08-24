using AutoMapper;

namespace Application.Features.Project.Create;

public sealed class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Command, Domain.Project>();
        CreateMap<Domain.Project, Response>();
    }
}
