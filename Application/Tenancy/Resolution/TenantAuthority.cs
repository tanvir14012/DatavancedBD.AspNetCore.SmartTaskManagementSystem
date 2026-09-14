using System.Globalization;

namespace Application.Tenancy.Resolution;

/// <summary>Strict, non-network normalization shared by requests and deployment configuration.</summary>
internal static class TenantAuthority
{
    internal static bool TryNormalize(string? value, out string canonicalAuthority)
    {
        canonicalAuthority = string.Empty;
        // DNS text is at most 253 characters; the optional colon and port add at most six.
        if (string.IsNullOrEmpty(value) || value.Length > 259)
            return false;

        var authority = value.AsSpan();
        var separator = authority.IndexOf(':');
        var host = separator < 0 ? authority : authority[..separator];
        if (host.Length is 0 or > 253)
            return false;

        if (separator >= 0)
        {
            var port = authority[(separator + 1)..];
            // Reject ambiguous spellings; :443 is distinct from an authority with no port.
            if (port.Length is 0 or > 5 || port[0] == '0' ||
                !int.TryParse(port, NumberStyles.None, CultureInfo.InvariantCulture, out var portNumber) ||
                portNumber is < 1 or > 65535)
                return false;
        }

        var labelLength = 0;
        var previous = '\0';
        foreach (var character in host)
        {
            if (character == '.')
            {
                if (labelLength == 0 || previous == '-')
                    return false;
                labelLength = 0;
            }
            else
            {
                if (!(char.IsAsciiLetterOrDigit(character) || character == '-') ||
                    (labelLength == 0 && character == '-') || ++labelLength > 63)
                    return false;
            }
            previous = character;
        }

        if (labelLength == 0 || previous == '-')
            return false;

        canonicalAuthority = value.ToLowerInvariant();
        return true;
    }
}
