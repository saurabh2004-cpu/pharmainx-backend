import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import { prisma } from "../lib/prisma";

export const instituteViewTrackerMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: paramId } = req.params as any;
    const id = paramId as string;

    if (!id) {
        return next();
    }

    const finalUserId: string | null = req.user?.id ? String(req.user.id) : null;

    try {
        // Use upsert to ensure only one view record per institute-user combination
        // If a record exists, update viewedAt; otherwise, create a new one
        await prisma.instituteView.upsert({
            where: {
                instituteId_userId: {
                    instituteId: id,
                    userId: finalUserId?.toString() || "",
                },
            },
            update: {
                viewedAt: new Date(),
            },
            create: {
                instituteId: id,
                userId: finalUserId?.toString() || "",
            },
        });
    } catch (err) {
        console.error("Error tracking institute view:", err);
    }

    next();
};
