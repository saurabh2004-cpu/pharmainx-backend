import { Request, Response } from 'express';
import { getServiceLogger } from '../utils/logger.js';

const logger = getServiceLogger("Specialty");

export const searchSpecialties = async (req: Request, res: Response) => {
    // Feature removed
    res.status(200).json({ specialties: [], page: 1, pageSize: 20, total: 0 });
};

export const createSpecialty = async (req: Request, res: Response) => {
    // Feature removed
    res.status(410).json({ error: "Specialty feature removed" });
};
