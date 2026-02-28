import { Request, Response, NextFunction } from "express";
import { identifyService } from "../services/identify.service";

export const identifyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { email, phoneNumber } = req.body;

    // Normalize input
    if (typeof email === "string") email = email.trim();
    if (typeof phoneNumber === "string") phoneNumber = phoneNumber.trim();

    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: "At least one of email or phoneNumber is required"
      });
    }

    const result = await identifyService(email, phoneNumber);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};