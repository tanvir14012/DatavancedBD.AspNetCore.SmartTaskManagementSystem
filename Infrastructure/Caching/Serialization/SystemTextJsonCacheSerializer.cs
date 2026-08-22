using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Infrastructure.Caching.Options;

namespace Infrastructure.Caching.Serialization;

public sealed class SystemTextJsonCacheSerializer : ICacheSerializer
{
    private static readonly byte[] GzipHeader = [0x1F, 0x8B];
    private readonly JsonSerializerOptions _jsonSerializerOptions;
    private readonly CachingOptions _options;

    public SystemTextJsonCacheSerializer(IOptions<CachingOptions> options)
    {
        _options = options.Value;
        _jsonSerializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = _options.UseCamelCaseJson ? JsonNamingPolicy.CamelCase : null
        };
    }

    public byte[] Serialize<T>(T value)
    {
        var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(value, _jsonSerializerOptions);
        if (!_options.EnableCompression || jsonBytes.Length < _options.CompressionThresholdBytes)
            return jsonBytes;

        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(jsonBytes, 0, jsonBytes.Length);
        }

        return output.ToArray();
    }

    public T? Deserialize<T>(byte[] bytes)
    {
        if (bytes.Length == 0)
            return default;

        if (IsGzipPayload(bytes))
        {
            using var input = new MemoryStream(bytes);
            using var gzip = new GZipStream(input, CompressionMode.Decompress);
            using var output = new MemoryStream();
            gzip.CopyTo(output);
            return JsonSerializer.Deserialize<T>(output.ToArray(), _jsonSerializerOptions);
        }

        return JsonSerializer.Deserialize<T>(bytes, _jsonSerializerOptions);
    }

    private static bool IsGzipPayload(byte[] bytes)
    {
        return bytes.Length >= GzipHeader.Length
            && bytes[0] == GzipHeader[0]
            && bytes[1] == GzipHeader[1];
    }
}
