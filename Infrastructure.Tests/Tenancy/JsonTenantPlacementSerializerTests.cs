using System.Text;
using System.Text.Json.Nodes;
using Application.Tenancy;
using Infrastructure.Tenancy.Caching;
using Microsoft.Extensions.Options;

namespace Infrastructure.Tests.Tenancy;

public sealed class JsonTenantPlacementSerializerTests
{
    private readonly JsonTenantPlacementSerializer _sut = new(Options.Create(new TenantPlacementCacheOptions()));
    private static TenantPlacement Placement(TenantIsolation isolation = TenantIsolation.Database)
        => new(Guid.Parse("99999999-1111-2222-3333-444444444444"), isolation, "target-1",
            isolation == TenantIsolation.Schema ? "org_1" : null, "eastus", long.MaxValue, TenantLifecycle.Active);

    [Theory]
    [InlineData(TenantIsolation.Database)]
    [InlineData(TenantIsolation.Schema)]
    [InlineData(TenantIsolation.Row)]
    public void RoundTripsAllStrategiesWithoutLosingLongPrecision(TenantIsolation isolation)
    {
        var placement = Placement(isolation);
        var bytes = _sut.Serialize(placement);
        Assert.Equal(placement, _sut.Deserialize(bytes));
        Assert.Equal(bytes, _sut.Serialize(placement));
    }

    [Theory]
    [InlineData("tenantId")]
    [InlineData("isolation")]
    [InlineData("schema")]
    [InlineData("targetId")]
    [InlineData("region")]
    [InlineData("version")]
    [InlineData("lifecycle")]
    [InlineData("formatVersion")]
    public void RejectsMissingFieldsInsteadOfUsingDefaultValues(string field)
    {
        var json = JsonNode.Parse(_sut.Serialize(Placement()))!.AsObject();
        json.Remove(field);
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize(Encoding.UTF8.GetBytes(json.ToJsonString())));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("{invalid}")]
    public void RejectsInvalidDocuments(string json)
        => Assert.Throws<InvalidDataException>(() => _sut.Deserialize(Encoding.UTF8.GetBytes(json)));

    [Fact]
    public void RejectsDuplicateAndUnknownFields()
    {
        var json = Encoding.UTF8.GetString(_sut.Serialize(Placement()));
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize(Encoding.UTF8.GetBytes(json.Insert(1, "\"isolation\":2,"))));
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize(Encoding.UTF8.GetBytes(json.Insert(1, "\"password\":\"secret\","))));
    }

    [Theory]
    [InlineData("formatVersion", "2")]
    [InlineData("version", "9223372036854775808")]
    [InlineData("version", "0")]
    [InlineData("isolation", "99")]
    [InlineData("lifecycle", "99")]
    [InlineData("tenantId", "\"00000000-0000-0000-0000-000000000000\"")]
    [InlineData("targetId", "null")]
    [InlineData("region", "\"Server=secret;Password=hidden\"")]
    public void RejectsInvalidFieldValuesWithoutLeakingContent(string field, string value)
    {
        var json = JsonNode.Parse(_sut.Serialize(Placement()))!.AsObject();
        json[field] = JsonNode.Parse(value);
        var error = Assert.Throws<InvalidDataException>(() => _sut.Deserialize(Encoding.UTF8.GetBytes(json.ToJsonString())));
        Assert.DoesNotContain("hidden", error.ToString());
    }

    [Fact]
    public void RejectsOversizeAndCompressedPayloadBeforeParsing()
    {
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize(new byte[32769]));
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize([0x1f, 0x8b, 0, 0]));
        Assert.Throws<InvalidDataException>(() => _sut.Deserialize([]));
    }
}
