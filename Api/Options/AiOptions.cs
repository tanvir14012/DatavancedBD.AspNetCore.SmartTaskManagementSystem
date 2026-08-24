namespace Api.Options;

public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public string GitHubModelsApiKey { get; set; } = string.Empty;
    public string GitHubModelsEndpoint { get; set; } = "https://models.inference.ai.azure.com";
    public string Model { get; set; } = "gpt-4o-mini";
    public bool Enabled { get; set; } = false;
}
