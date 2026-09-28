namespace Application.Interfaces;

/// <summary>Optional description-improvement service exposed to application use cases.</summary>
public interface IAiService
{
    /// <summary>Returns an improved description when the integration is enabled and succeeds.</summary>
    Task<string?> ImproveDescriptionAsync(string description, CancellationToken cancellationToken = default);
    /// <summary>Is enabled for this application interfaces contract.</summary>
    bool IsEnabled { get; }
}
