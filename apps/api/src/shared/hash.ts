/**
 * argon2id wrappers (feat4 / NFR-05). OWASP 2024 baseline params:
 *   memory = 19 MiB, iterations = 2, parallelism = 1.
 *
 * We deliberately keep this wrapper tiny so login is the *only* place that
 * touches argon2id (the purchase path never does). That keeps the heavy
 * memory cost away from the 1000-VU hot path.
 */

import * as argon2 from "@node-rs/argon2";

const PARAMS: argon2.Options = {
  algorithm: argon2.Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, PARAMS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
