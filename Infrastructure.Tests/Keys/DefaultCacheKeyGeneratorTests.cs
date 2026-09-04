using Infrastructure.Caching.Keys;

namespace Infrastructure.Tests.Keys;

public class DefaultCacheKeyGeneratorTests
{
    private readonly DefaultCacheKeyGenerator _sut = new();

    [Fact]
    public void Build_JoinsNonEmptySegmentsWithColon()
    {
        var key = _sut.Build("http", "route", "user-1");

        Assert.Equal("http:route:user-1", key);
    }

    [Fact]
    public void Build_SkipsNullAndWhitespaceSegments()
    {
        var key = _sut.Build("ef", null, "  ", "Task", "42");

        Assert.Equal("ef:Task:42", key);
    }

    [Fact]
    public void Build_StripsWhitespaceAndNewlinesFromSegments()
    {
        var key = _sut.Build(" route with spaces \r\n");

        Assert.Equal("route-with-spaces", key);
    }

    [Fact]
    public void Normalize_AddsPrefixWhenKeyIsNotYetPrefixed()
    {
        var normalized = _sut.Normalize("stms", "http:route:user-1");

        Assert.Equal("stms:http:route:user-1", normalized);
    }

    [Fact]
    public void Normalize_IsIdempotentForAlreadyPrefixedKeys()
    {
        var normalizedOnce = _sut.Normalize("stms", "http:route:user-1");
        var normalizedTwice = _sut.Normalize("stms", normalizedOnce);

        Assert.Equal(normalizedOnce, normalizedTwice);
        Assert.False(normalizedTwice.StartsWith("stms:stms:", StringComparison.Ordinal));
    }

    [Fact]
    public void Normalize_PreservesWildcardSuffixForPatterns()
    {
        var normalized = _sut.Normalize("stms", "ef:Task:*");

        Assert.Equal("stms:ef:Task:*", normalized);
    }

    [Fact]
    public void Normalize_ReturnsSanitizedKeyWhenPrefixIsEmpty()
    {
        var normalized = _sut.Normalize(string.Empty, "route:x");

        Assert.Equal("route:x", normalized);
    }
}
