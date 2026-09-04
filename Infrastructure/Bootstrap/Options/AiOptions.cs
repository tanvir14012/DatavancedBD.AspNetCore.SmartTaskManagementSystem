namespace Infrastructure.Bootstrap.Options;

public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public string GroqApiKey { get; set; } = string.Empty;
    public string GroqEndpoint { get; set; } = "https://api.groq.com/openai/v1";
    public string Model { get; set; } = "mixtral-8x7b-32768";
    public bool Enabled { get; set; } = false;
}
