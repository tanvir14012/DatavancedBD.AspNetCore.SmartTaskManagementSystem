using FluentValidation;
using Domain.Enums;

namespace Application.Features.Task.Create;

public sealed class Validator : AbstractValidator<Command>
{
    public Validator()
    {
        RuleFor(x => x.ProjectId)
            .GreaterThan(0)
            .WithMessage("Project ID must be valid.");

        RuleFor(x => x.Title)
            .NotEmpty()
            .WithMessage("Task title is required.")
            .MaximumLength(200)
            .WithMessage("Task title cannot exceed 200 characters.")
            .Must(IsValidTaskTitle)
            .WithMessage("Task title contains invalid characters.");

        RuleFor(x => x.Description)
            .MaximumLength(4000)
            .WithMessage("Task description cannot exceed 4000 characters.");

        RuleFor(x => x.DueDate)
            .Must(date => !date.HasValue || date.Value >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .WithMessage("Due date cannot be in the past.");

        RuleFor(x => x.Status)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<ProjectTaskStatus>(value, true, out _))
            .WithMessage("Invalid task status. Valid values are: Todo, InProgress, Completed, Cancelled.");

        RuleFor(x => x.Priority)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<TaskPriority>(value, true, out _))
            .WithMessage("Invalid task priority. Valid values are: Low, Medium, High, Critical.");

        RuleFor(x => x.AssigneeEmail)
            .Must(value => string.IsNullOrWhiteSpace(value) || IsValidEmail(value))
            .WithMessage("Assignee email must be a valid email address.");
    }

    private static bool IsValidTaskTitle(string title)
    {
        return !string.IsNullOrWhiteSpace(title) &&
               title.All(ch => char.IsLetterOrDigit(ch) || char.IsWhiteSpace(ch) || "-_.&():'\"".Contains(ch));
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var index = email.IndexOf('@');
            return index > 0 && index < email.Length - 1 && email.Contains('.') && !email.Contains(' ');
        }
        catch
        {
            return false;
        }
    }
}
