using Api.Options;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace Api.Services;

public sealed class GroqModelsAiService : IAiService
{
    private readonly AiOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<GroqModelsAiService> _logger;

    public bool IsEnabled => _options.Enabled && !string.IsNullOrWhiteSpace(_options.GroqApiKey);

    public GroqModelsAiService(
        IOptions<AiOptions> options,
        HttpClient httpClient,
        ILogger<GroqModelsAiService> logger)
    {
        _options = options.Value;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<string?> ImproveDescriptionAsync(string description, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            _logger.LogWarning("AI service is not enabled");
            return null;
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return null;
        }

        try
        {
            var prompt = $"""
                You are a task management assistant. Improve the following task description by:
                1. Correcting grammar and spelling
                2. Improving clarity and readability
                3. Making it more professional
                4. Expanding if too short to be actionable
                5. Ensuring it's specific and measurable
                
                Original description: "{description}"
                
                Provide only the improved description without any additional commentary.
                """;

            var request = new
            {
                messages = new[]
                {
                    new { role = "user", content = prompt }
                },
                model = _options.Model,
                temperature = 0.7,
                max_tokens = 500
            };

            var requestJson = JsonSerializer.Serialize(request);
            _logger.LogDebug("Sending request to Groq: {RequestJson}", requestJson);

            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, $"{_options.GroqEndpoint}/chat/completions")
            {
                Content = new StringContent(requestJson, System.Text.Encoding.UTF8, "application/json")
            };

            requestMessage.Headers.Add("Authorization", $"Bearer {_options.GroqApiKey}");

            var response = await _httpClient.SendAsync(requestMessage, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("Groq API returned status code {StatusCode}: {ErrorContent}", response.StatusCode, errorContent);
                return null;
            }

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            using var jsonDoc = JsonDocument.Parse(responseContent);
            var root = jsonDoc.RootElement;

            if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var content))
                {
                    return content.GetString()?.Trim();
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Groq API");
            return null;
        }
    }
}
