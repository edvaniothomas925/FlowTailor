import bcrypt from 'bcryptjs';

/**
 * Hashes a plaintext password or PIN using bcrypt with salt rounds
 */
export async function hashPassword(plainText: string, saltRounds = 10): Promise<string> {
  return bcrypt.hash(plainText, saltRounds);
}

/**
 * Compares a plaintext password against a bcrypt hash
 */
export async function comparePassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}
