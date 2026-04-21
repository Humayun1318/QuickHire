/**
 * @file jwt.ts
 * @description JWT (JSON Web Token) generation and verification utilities
 * Handles token creation and validation for user authentication
 */

import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

/**
 * Generate a new JWT token
 *
 * JWT tokens are digitally signed and contain encoded user information
 * Structure: header.payload.signature
 *
 * Purpose: Create tokens for authentication (access tokens, refresh tokens)
 *
 * @param {JwtPayload} payload - Data to encode in the token (user id, email, role, etc.)
 * @param {string} jwtSecret - Secret key used to sign the token
 *                            - Must match the secret used to verify the token
 *                            - Should be stored securely in environment variables
 * @param {string} expiresIn - Token expiration time (e.g., '24h', '7d', '1w', '30d')
 *                            - After this time, the token is considered invalid
 *                            - Format: https://github.com/vercel/ms
 *
 * @returns {string} Signed JWT token that can be sent to client
 *
 * Usage Examples:
 *
 * Access token (short-lived):
 * const accessToken = generateToken(
 *   { userId: '123', email: 'user@example.com', role: 'user' },
 *   process.env.JWT_ACCESS_SECRET,
 *   '1h'
 * );
 *
 * Refresh token (long-lived):
 * const refreshToken = generateToken(
 *   { userId: '123' },
 *   process.env.JWT_REFRESH_SECRET,
 *   '7d'
 * );
 */
export const generateToken = (
  payload: JwtPayload,
  jwtSecret: string,
  expiresIn: string,
) => {
  /**
   * Sign the payload with the provided secret
   * - Payload: Contains the actual data (claims)
   * - Secret: Used to create the signature and verify authenticity
   * - Options: Includes expiration time and other JWT options
   */
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn,
  } as SignOptions);

  return token;
};

/**
 * Verify and decode a JWT token
 *
 * Purpose: Validate token authenticity and extract encoded data
 *
 * Verification steps:
 * 1. Check token signature matches the secret
 * 2. Check token hasn't expired
 * 3. Extract and return payload data
 * 4. Throw error if token is invalid or expired
 *
 * @param {string} token - JWT token to verify (from Authorization header)
 * @param {string} jwtSecret - Secret key used to sign the token
 *                            - Must be the SAME secret used during token generation
 *                            - Different secrets for access/refresh tokens
 *
 * @returns {JwtPayload} Decoded payload containing user information
 *
 * @throws Error if token is:
 * - Invalid (signature doesn't match)
 * - Expired (current time > expiration time)
 * - Malformed (not a valid JWT)
 *
 * Usage Example:
 * try {
 *   const decoded = verifyToken(token, process.env.JWT_ACCESS_SECRET);
 *   console.log(decoded); // { userId: '123', email: 'user@example.com', ... }
 * } catch (error) {
 *   console.log('Token invalid or expired');
 * }
 */
export const verifyToken = (token: string, jwtSecret: string) => {
  /**
   * Verify token signature and expiration
   * Throws error if verification fails
   * Returns decoded payload if verification succeeds
   */
  const verifiedToken = jwt.verify(token, jwtSecret);

  return verifiedToken;
};
