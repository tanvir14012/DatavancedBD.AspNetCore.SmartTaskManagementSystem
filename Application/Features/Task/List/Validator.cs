using FluentValidation;
using Domain.Enums;

namespace Application.Features.Task.List;

public sealed class Validator : AbstractValidator<Query>
{
    public Validator()
    {
        RuleFor(x => x.Start)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Start index cannot be negative.");

        RuleFor(x => x.Length)
            .GreaterThan(0)
            .WithMessage("Page length must be greater than zero.");

        RuleFor(x => x.ProjectId)
            .Must(projectId => !projectId.HasValue || projectId.Value > 0)
            .WithMessage("Project ID must be valid.");

        RuleFor(x => x.AssigneeId)
            .Must(assigneeId => string.IsNullOrWhiteSpace(assigneeId) || int.TryParse(assigneeId, out _))
            .WithMessage("Assignee ID must be valid.");

        RuleFor(x => x.Status)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<ProjectTaskStatus>(value, true, out _))
            .WithMessage("Invalid task status. Valid values are: Todo, InProgress, Completed, Cancelled.");

        RuleFor(x => x.Priority)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<TaskPriority>(value, true, out _))
            .WithMessage("Invalid task priority. Valid values are: Low, Medium, High, Critical.");
    }
}
