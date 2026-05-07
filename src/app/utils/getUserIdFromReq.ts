import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export const getUserIdFromReq = (req: Request): string => {
    return (req.user as JwtPayload).userId;
};