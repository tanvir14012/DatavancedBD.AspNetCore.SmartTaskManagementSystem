using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Bootstrap.Middleware;

public sealed class RequestTracingMiddleware(
    ILogger<RequestTracingMiddleware> logger) : IMiddleware
{
    public const string TraceIdHeaderName = "X-Trace-Id";
    public const string TraceIdPropertyName = "traceId";

    private readonly ILogger<RequestTracingMiddleware> _logger = logger;

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var traceId = ResolveTraceId(context);
        context.Response.Headers[TraceIdHeaderName] = traceId;

        var originalBodyStream = context.Response.Body;
        await using var responseBuffer = new MemoryStream();
        context.Response.Body = responseBuffer;

        try
        {
            await next(context).ConfigureAwait(false);
            await WriteTracedResponseAsync(context, responseBuffer, originalBodyStream, traceId).ConfigureAwait(false);
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }

    private async Task WriteTracedResponseAsync(
        HttpContext context,
        MemoryStream responseBuffer,
        Stream originalBodyStream,
        string traceId)
    {
        if (!ShouldAddTraceId(context.Response, responseBuffer))
        {
            responseBuffer.Position = 0;
            await responseBuffer.CopyToAsync(originalBodyStream, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        responseBuffer.Position = 0;
        JsonDocument document;
        try
        {
            document = await JsonDocument.ParseAsync(responseBuffer, cancellationToken: context.RequestAborted).ConfigureAwait(false);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Skipping traceId body injection because response JSON is invalid for {Path}.", context.Request.Path);
            responseBuffer.Position = 0;
            await responseBuffer.CopyToAsync(originalBodyStream, context.RequestAborted).ConfigureAwait(false);
            return;
        }

        using (document)
        await using (var tracedResponse = new MemoryStream())
        {
            await using (var writer = new Utf8JsonWriter(tracedResponse))
            {
                WriteTracedPayload(writer, document.RootElement, traceId, context.Response.StatusCode);
            }

            context.Response.ContentLength = tracedResponse.Length;
            tracedResponse.Position = 0;
            await tracedResponse.CopyToAsync(originalBodyStream, context.RequestAborted).ConfigureAwait(false);
        }
    }

    private static bool ShouldAddTraceId(HttpResponse response, MemoryStream responseBuffer)
    {
        if (responseBuffer.Length == 0)
            return false;

        if (response.StatusCode is StatusCodes.Status204NoContent or StatusCodes.Status304NotModified)
            return false;

        return response.ContentType?.Contains("json", StringComparison.OrdinalIgnoreCase) is true;
    }

    private static string ResolveTraceId(HttpContext context)
    {
        var inboundTraceId = context.Request.Headers[TraceIdHeaderName].ToString();
        if (!string.IsNullOrWhiteSpace(inboundTraceId))
            return inboundTraceId;

        return Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
    }

    private static void WriteTracedPayload(Utf8JsonWriter writer, JsonElement root, string traceId, int statusCode)
    {
        if (root.ValueKind is JsonValueKind.Object)
        {
            writer.WriteStartObject();

            var hasTraceId = false;
            foreach (var property in root.EnumerateObject())
            {
                if (property.NameEquals(TraceIdPropertyName))
                {
                    hasTraceId = true;
                }

                property.WriteTo(writer);
            }

            if (!hasTraceId)
            {
                writer.WriteString(TraceIdPropertyName, traceId);
            }

            writer.WriteEndObject();
            return;
        }

        writer.WriteStartObject();
        writer.WriteString(TraceIdPropertyName, traceId);
        writer.WritePropertyName(statusCode >= StatusCodes.Status400BadRequest ? "error" : "data");
        root.WriteTo(writer);
        writer.WriteEndObject();
    }
}
