using Domain.Enums;
using FluentValidation;

namespace Application.Features.Project.Members;

public sealed class Validator : AbstractValidator<AssignCommand>
{
    public Validator()
    {
        RuleFor(x => x.ProjectId)
            .GreaterThan(0)
            .WithMessage("Project ID must be valid.");

        RuleFor(x => x.UserId)
            .GreaterThan(0)
            .WithMessage("User ID must be valid.");

        RuleFor(x => x.Role)
            .Must(value => Enum.TryParse<ProjectRole>(value, true, out _))
            .WithMessage("Invalid role. Must be one of: Owner, Manager, Member, Viewer");
    }
}
