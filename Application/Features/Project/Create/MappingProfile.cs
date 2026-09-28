using AutoMapper;

namespace Application.Features.Project.Create;

/// <summary>Maps persistence objects to project create response contracts.</summary>
public sealed class MappingProfile : Profile
{
    /// <summary>Creates the project create mapping profile with its required dependencies.</summary>
    public MappingProfile()
    {
        CreateMap<Command, Domain.Project>();
        CreateMap<Domain.Project, Response>();
    }
}
