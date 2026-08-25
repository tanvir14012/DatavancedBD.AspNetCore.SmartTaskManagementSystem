using FluentValidation;
using Domain.Enums;

namespace Application.Features.Task.Board;

public sealed class Validator : AbstractValidator<Query>
{
    public Validator()
    {
        RuleFor(x => x.ProjectId)
            .Must(projectId => !projectId.HasValue || projectId.Value > 0)
            .WithMessage("Project ID must be valid.");

        RuleFor(x => x.Priority)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<TaskPriority>(value, true, out _))
            .WithMessage("Invalid task priority. Valid values are: Low, Medium, High, Critical.");
    }
}
