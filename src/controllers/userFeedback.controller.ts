import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { FeedbackType } from '../generated/prisma/client.ts';
import { getServiceLogger } from '../utils/logger.js';
import { logActivity } from '../utils/activityLogger.js';
import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';


const logger: any = getServiceLogger("UserFeedback");

export const createFeedBack = async (req: Request, res: Response) => {
    const { feedbackType, message } = req.body

    if (!feedbackType || !message) {
        return res.status(400).json({ message: "Feedback type and message are required" });
    }

    const isValidFeedbackType = Object.values(FeedbackType).includes(
        feedbackType as FeedbackType
    );

    if (!isValidFeedbackType) {
        return res.status(400).json({
            message: "Invalid feedback type",
            allowedValues: Object.values(FeedbackType),
        });
    }

    try {
        const feedback = await prisma.userFeedbacks.create({
            data: {
                feedbackType: feedbackType as FeedbackType,
                message: message,
                user: {
                    connect: {
                        id: (req as any).user.id
                    }
                }
            }
        })

        if (!feedback) {
            return res.status(400).json({ message: "Failed to create feedback" });
        }

        await logActivity({
            module: ActivityLogsModule.USER_FEEDBACKS,
            action: ActivityActionType.CREATE,
            userId: (req as any).user.id,
            description: `New feedback created by user: ${(req as any).user.id}`,
            newData: feedback
        })

        res.status(200).json({ message: "Message Sent successfully", feedback });
    } catch (error) {
        logger.error("Error creating feedback:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const getFeedBacks = async (req: Request, res: Response) => {
    const { feedbackType, page, limit } = req.query;

    if (!page || !limit) {
        return res.status(400).json({ message: "Page and limit are required" });
    }

    let where: any = {};

    if (feedbackType) {
        if (
            typeof feedbackType !== "string" ||
            !Object.values(FeedbackType).includes(
                feedbackType as FeedbackType
            )
        ) {
            return res.status(400).json({
                message: "Invalid feedback type",
                allowedValues: Object.values(FeedbackType),
            });
        }

        where.feedbackType = feedbackType as FeedbackType;
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    try {
        const feedbacks = await prisma.userFeedbacks.findMany({
            where: {
                ...where,
            },
            skip,
            take: limitNumber,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!feedbacks) {
            return res.status(404).json({ message: "No feedbacks found" });
        }

        return res.status(200).json({ message: "Feedbacks fetched successfully", feedbacks });
    } catch (error) {
        logger.error("Error fetching feedbacks:", error);
        return res.status(500).json({ message: "Internal server error" });
    }

}

export const getFeedbackById = async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "Feedback ID is required" });
    }

    try {
        const feedback = await prisma.userFeedbacks.findUnique({
            where: {
                id: id as string,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!feedback) {
            return res.status(404).json({ message: "No feedback found" });
        }

        return res.status(200).json({ message: "Feedback fetched successfully", feedback });
    } catch (error) {
        logger.error("Error fetching feedback:", error);
        return res.status(500).json({ message: "Internal server error" });
    }

}