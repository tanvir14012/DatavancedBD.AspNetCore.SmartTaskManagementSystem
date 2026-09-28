using AutoMapper;

namespace Application.Features.Project.Get;

/// <summary>Maps persistence objects to project get response contracts.</summary>
public sealed class MappingProfile : Profile
{
    /// <summary>Creates the project get mapping profile with its required dependencies.</summary>
    public MappingProfile()
    {
        CreateMap<Domain.Project, Response>();
    }
}
