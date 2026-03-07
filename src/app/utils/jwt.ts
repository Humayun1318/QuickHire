import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';

export const generateToken = (
  payload: JwtPayload,
  jwtSecret: string,
  expiresIn: string,
) => {
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn,
  } as SignOptions);

  return token;
};

export const verifyToken = (token: string, jwtSecret: string) => {
  const verifiedToken = jwt.verify(token, jwtSecret);

  return verifiedToken;
};
