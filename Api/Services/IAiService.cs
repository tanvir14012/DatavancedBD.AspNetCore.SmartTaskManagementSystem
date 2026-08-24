namespace Api.Services;

public interface IAiService
{
    Task<string?> ImproveDescriptionAsync(string description, CancellationToken cancellationToken = default);
    bool IsEnabled { get; }
}
