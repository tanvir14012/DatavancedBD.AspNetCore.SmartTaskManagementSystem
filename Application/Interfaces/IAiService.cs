namespace Application.Interfaces;

public interface IAiService
{
    Task<string?> ImproveDescriptionAsync(string description, CancellationToken cancellationToken = default);
    bool IsEnabled { get; }
}
