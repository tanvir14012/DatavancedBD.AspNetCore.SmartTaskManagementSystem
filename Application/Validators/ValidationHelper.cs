namespace Application.Validators;

public static class ValidationHelper
{
    public const int MaxNameLength = 200;
    public const int MaxDescriptionLength = 1000;
    public const int MaxTaskTitleLength = 200;
    public const int MaxTaskDescriptionLength = 4000;
    public const int MaxFirstNameLength = 25;
    public const int MaxLastNameLength = 25;
    public const int MaxImageUrlLength = 250;
    public const int MinPasswordLength = 8;
    public const int MinEmailLength = 3;

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

    public static bool IsValidProjectName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxNameLength)
            return false;

        return System.Text.RegularExpressions.Regex.IsMatch(name, @"^[a-zA-Z0-9\s\-_.&()]+$");
    }

    public static bool IsValidTaskTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Length > MaxTaskTitleLength)
            return false;

        return System.Text.RegularExpressions.Regex.IsMatch(title, @"^[a-zA-Z0-9\s\-_.&():'""]+$");
    }

    public static bool IsPastDate(DateOnly? date)
    {
        if (!date.HasValue)
            return false;

        return date.Value < DateOnly.FromDateTime(DateTime.UtcNow);
    }

    public static bool IsValidDateRange(DateOnly? startDate, DateOnly? endDate)
    {
        if (!startDate.HasValue || !endDate.HasValue)
            return true;

        return startDate <= endDate;
    }

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
