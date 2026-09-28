import { pbkdf2 as derive, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(derive);

/** ASP.NET Core Identity V3 password hash (PRF HMACSHA512, 100000 iterations). */
export async function hashIdentityPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const subkey = await pbkdf2(password, salt, 100_000, 32, 'sha512');
  const result = Buffer.alloc(13 + salt.length + subkey.length);
  result[0] = 1;
  result.writeUInt32BE(2, 1);
  result.writeUInt32BE(100_000, 5);
  result.writeUInt32BE(salt.length, 9);
  salt.copy(result, 13);
  subkey.copy(result, 13 + salt.length);
  return result.toString('base64');
}

/** Verifies Identity V2/V3 hashes without logging the credential or decoded hash. */
export async function verifyIdentityPassword(
  password: string,
  encoded: string | null,
): Promise<boolean> {
  if (!encoded || encoded.length > 1024) return false;
  let hash: Buffer;
  try {
    hash = Buffer.from(encoded, 'base64');
  } catch {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  let iterations: number;
  let algorithm: 'sha1' | 'sha256' | 'sha512';
  if (hash[0] === 0 && hash.length === 49) {
    salt = hash.subarray(1, 17);
    expected = hash.subarray(17);
    iterations = 1000;
    algorithm = 'sha1';
  } else if (hash[0] === 1 && hash.length >= 45) {
    const prf = hash.readUInt32BE(1);
    iterations = hash.readUInt32BE(5);
    const saltLength = hash.readUInt32BE(9);
    if (
      iterations < 1000 ||
      iterations > 1_000_000 ||
      saltLength < 16 ||
      saltLength > 128 ||
      hash.length - 13 - saltLength < 16
    )
      return false;
    if (prf === 0) algorithm = 'sha1';
    else if (prf === 1) algorithm = 'sha256';
    else if (prf === 2) algorithm = 'sha512';
    else return false;
    salt = hash.subarray(13, 13 + saltLength);
    expected = hash.subarray(13 + saltLength);
  } else return false;
  const actual = await pbkdf2(
    password,
    salt,
    iterations,
    expected.length,
    algorithm,
  );
  return timingSafeEqual(actual, expected);
}
