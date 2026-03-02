import { ActivityLogsModule, ActivityActionType } from '../generated/prisma/client.ts';
import { prisma } from '../lib/prisma.js';

interface LogActivityParams {
    module: ActivityLogsModule;
    action: ActivityActionType;
    oldData?: any;
    newData?: any;
    description?: string;
}

/**
 * Reusable asynchronous utility for creating non-blocking Activity Logs.
 * Catches all errors and prevents them from bubbling up to interrupt controller flow.
 */
export const logActivity = async ({
    module,
    action,
    oldData = undefined,
    newData = undefined,
    description = undefined,
}: LogActivityParams): Promise<void> => {
    try {
        await prisma.activityLogs.create({
            data: {
                module,
                action,
                oldData,
                newData,
                description,
            },
        });
    } catch (error) {
        // Suppress failure and strictly log internally to avoid interrupting the main flow.
        console.error(`[ActivityLogger Error] Failed to log activity for module: ${module}, action: ${action}`, error);
    }
};
