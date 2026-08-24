using Api.Options;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace Api.Services;

public sealed class GitHubModelsAiService : IAiService
{
    private readonly AiOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<GitHubModelsAiService> _logger;

    public bool IsEnabled => _options.Enabled && !string.IsNullOrWhiteSpace(_options.GitHubModelsApiKey);

    public GitHubModelsAiService(
        IOptions<AiOptions> options,
        HttpClient httpClient,
        ILogger<GitHubModelsAiService> logger)
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
                temperature = 0.3,
                max_tokens = 500
            };

            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, $"{_options.GitHubModelsEndpoint}/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(request), System.Text.Encoding.UTF8, "application/json")
            };

            requestMessage.Headers.Add("Authorization", $"Bearer {_options.GitHubModelsApiKey}");

            var response = await _httpClient.SendAsync(requestMessage, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("GitHub Models API returned status code {StatusCode}", response.StatusCode);
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
            _logger.LogError(ex, "Error calling GitHub Models API");
            return null;
        }
    }
}
