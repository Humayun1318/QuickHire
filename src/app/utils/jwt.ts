
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

export const generateToken = (
  payload: JwtPayload,
  jwtSecret: string,
  expiresIn: string,
): string => {
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

export const verifyToken = (token: string, jwtSecret: string): string | jwt.JwtPayload => {
  /**
   * Verify token signature and expiration
   * Throws error if verification fails
   * Returns decoded payload if verification succeeds
   */
  const verifiedToken = jwt.verify(token, jwtSecret);

  return verifiedToken;
};
