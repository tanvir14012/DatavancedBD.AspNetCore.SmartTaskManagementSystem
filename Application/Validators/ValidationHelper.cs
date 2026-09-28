namespace Application.Validators;

/// <summary>Shared input limits and validation rules used by application validators.</summary>
public static class ValidationHelper
{
    /// <summary>The maximum permitted name length.</summary>
    public const int MaxNameLength = 200;
    /// <summary>The maximum permitted description length.</summary>
    public const int MaxDescriptionLength = 1000;
    /// <summary>The maximum permitted task title length.</summary>
    public const int MaxTaskTitleLength = 200;
    /// <summary>The maximum permitted task description length.</summary>
    public const int MaxTaskDescriptionLength = 4000;
    /// <summary>The maximum permitted first name length.</summary>
    public const int MaxFirstNameLength = 25;
    /// <summary>The maximum permitted last name length.</summary>
    public const int MaxLastNameLength = 25;
    /// <summary>The maximum permitted image url length.</summary>
    public const int MaxImageUrlLength = 250;
    /// <summary>The minimum permitted password length.</summary>
    public const int MinPasswordLength = 8;
    /// <summary>The minimum permitted email length.</summary>
    public const int MinEmailLength = 3;

    /// <summary>Checks that the input is a well-formed email address.</summary>
    public static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Checks the configured minimum length and character-class requirements.</summary>
    public static bool IsStrongPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinPasswordLength)
            return false;

        bool hasUpperCase = password.Any(char.IsUpper);
        bool hasLowerCase = password.Any(char.IsLower);
        bool hasDigit = password.Any(char.IsDigit);
        bool hasSpecialChar = password.Any(ch => "!@#$%^&*".Contains(ch));

        return hasUpperCase && hasLowerCase && hasDigit && hasSpecialChar;
    }

    /// <summary>Checks the project-name length and permitted characters.</summary>
    public static bool IsValidProjectName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxNameLength)
            return false;

        return System.Text.RegularExpressions.Regex.IsMatch(name, @"^[a-zA-Z0-9\s\-_.&()]+$");
    }

    /// <summary>Checks the task-title length and permitted characters.</summary>
    public static bool IsValidTaskTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Length > MaxTaskTitleLength)
            return false;

        return System.Text.RegularExpressions.Regex.IsMatch(title, @"^[a-zA-Z0-9\s\-_.&():'""]+$");
    }

    /// <summary>Checks whether a supplied calendar date precedes the current UTC date.</summary>
    public static bool IsPastDate(DateOnly? date)
    {
        if (!date.HasValue)
            return false;

        return date.Value < DateOnly.FromDateTime(DateTime.UtcNow);
    }

    /// <summary>Checks that the start does not follow the end when both dates are supplied.</summary>
    public static bool IsValidDateRange(DateOnly? startDate, DateOnly? endDate)
    {
        if (!startDate.HasValue || !endDate.HasValue)
            return true;

        return startDate <= endDate;
    }

    /// <summary>Groups field-specific errors into a validation response.</summary>
    public static Dictionary<string, string[]> CreateValidationProblem(params (string Field, string Message)[] errors)
    {
        var result = new Dictionary<string, string[]>();
        foreach (var (field, message) in errors)
        {
            if (!string.IsNullOrWhiteSpace(field) && !string.IsNullOrWhiteSpace(message))
            {
                if (!result.ContainsKey(field))
                {
                    result[field] = new[] { message };
                }
                else
                {
                    var current = result[field].ToList();
                    current.Add(message);
                    result[field] = current.ToArray();
                }
            }
        }
        return result;
    }
}
