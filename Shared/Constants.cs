namespace Shared;

/// <summary>Names and defaults shared by the application hosts and clients.</summary>
public static class Constants
{
    /// <summary>The service name used in API metadata and telemetry.</summary>
    public const string ServiceName = "Smart Task Management System";
    /// <summary>The short service identifier used for resource naming.</summary>
    public const string ServicePrefix = "stms";
    /// <summary>The client-relative image shown when no custom image is available.</summary>
    public const string DefaultImageUrl = "/images/default.png";
    /// <summary>The application roles available during identity provisioning.</summary>
    public static readonly string[] Roles = new string[] { "Admin", "Project Manager", "Team Member" };
}
