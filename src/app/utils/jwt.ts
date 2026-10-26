import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

// Tokens are always signed and verified with HS256. Pinning the algorithm on
// verify rules out algorithm-confusion attacks (e.g. "alg": "none").
const JWT_ALGORITHM = 'HS256' as const;

export const generateToken = (
  payload: JwtPayload,
  jwtSecret: string,
  expiresIn: string,
): string => {
  return jwt.sign(payload, jwtSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn,
  } as SignOptions);
};

/**
 * Verifies signature and expiry. Throws JsonWebTokenError / TokenExpiredError,
 * which the global error handler maps to 401.
 */
export const verifyToken = (token: string, jwtSecret: string): JwtPayload => {
  const verified = jwt.verify(token, jwtSecret, {
    algorithms: [JWT_ALGORITHM],
  });

  if (typeof verified === 'string') {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return verified;
};
