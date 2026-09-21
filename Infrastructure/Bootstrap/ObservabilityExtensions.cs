using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Infrastructure.Bootstrap;

public static class ObservabilityExtensions
{
    public static IServiceCollection AddObservability(this IServiceCollection services, IConfiguration configuration, string serviceName)
    {
        var serviceVersion = Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "unknown";
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Production";

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(
                serviceName: serviceName,
                serviceVersion: serviceVersion,
                serviceInstanceId: Environment.MachineName)
                .AddAttributes([new KeyValuePair<string, object>("deployment.environment", environment)]))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddConsoleExporter();

                var tracesEndpoint = configuration["Observability:Otlp:TracesEndpoint"];
                if (!string.IsNullOrWhiteSpace(tracesEndpoint))
                    tracing.AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(tracesEndpoint);
                        options.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf;
                    });
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddConsoleExporter();

                var metricsEndpoint = configuration["Observability:Otlp:MetricsEndpoint"];
                if (!string.IsNullOrWhiteSpace(metricsEndpoint))
                    metrics.AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(metricsEndpoint);
                        options.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.HttpProtobuf;
                    });
            });

        return services;
    }
}
