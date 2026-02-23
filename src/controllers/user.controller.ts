import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getServiceLogger } from '../utils/logger.js';
import { AuthRoles, Prisma, VerificationStatus } from '../generated/prisma/client.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const logger = getServiceLogger("User");

// Extend Request to include user from auth middleware
interface AuthRequest extends Request {
    user?: {
        id: number;
        role: string;
    };
}

export const SignupUser = async (req: AuthRequest, res: Response) => {
    console.log('create user request received');

    const {
        firstName,
        lastName,
        country,
        city,
        verified,
        role,
        email,
        password,
        university,
        degree,
        yearOfStudy,
        gender,
        specialization,
        speciality,
        subSpeciality,
        experience
    } = req.body;

    try {
        const existingAuth = await prisma.user.findUnique({ where: { email } });
        if (existingAuth) {
            logger.warn({ email }, 'Attempt to create duplicate user');
            return res.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction to ensure both records are created or neither
        const user = await prisma.$transaction(async (tx) => {

            // 2. Create User Profile
            const newUser = await tx.user.create({
                data: {
                    firstName,
                    lastName,
                    country,
                    city,
                    verified: verified || false,
                    role: role as any,
                    email,
                    password: hashedPassword,
                    university,
                    degree,
                    yearOfStudy,
                    gender,
                    specialization,
                    speciality,
                    subSpeciality,
                    experience: experience ? parseInt(experience as string) : null
                }
            });
            return newUser;
        });

        logger.info({ userId: user.id }, 'User created successfully');
        res.status(200).json(user);
    } catch (err) {
        logger.error({ err, }, 'Database error during user creation');
        res.status(500).json({ error: 'Database error' });
    }
};

export const signInUser = async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
        // 1. Check Auth table
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            logger.error({ email }, 'Auth record exists but User profile missing');
            return res.status(500).json({ error: 'User profile not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET || 'secret', { expiresIn: '1h' }
        );


        logger.info({ email }, 'User signed in successfully');

        res
            // .cookie("accessToken", token, {
            //     httpOnly: true,
            //     secure: true,
            //     sameSite: 'lax',
            //     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            // })
            .status(200)
            .json({ token, role: user.role });
    } catch (err) {
        logger.error({ err, email }, 'Database error during signInUser');
        res.status(500).json({ error: 'Database error' });
    }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId;
    const authId = req.user?.id;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (id !== authId) {
        logger.warn({ authId, id }, "User tried to update another user's profile");
        return res.status(403).json({ error: 'Forbidden: cannot update another user' });
    }

    const updateData = req.body;

    const authRole = AuthRoles.USER;

    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                ...updateData,
            },
        });

        logger.info({ authId, user }, 'User updated successfully');
        res.status(200).json(user);
    } catch (err: any) {
        if (err.code === 'P2025') {
            logger.warn({ authId, id }, 'User not found during update');
            return res.status(404).json({ error: 'User not found' });
        }
        logger.error({ err, authId, id, body: updateData }, 'Database error during user update');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId;
    const authId = req.user?.id;

    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (id !== authId) {
        logger.warn({ authId, id }, "User tried to delete another user's profile");
        return res.status(403).json({ error: 'Forbidden: cannot delete another user' });
    }

    try {
        await prisma.user.delete({ where: { id } });
        logger.info({ authId, id }, 'User deleted successfully');
        res.status(204).send();
    } catch (err: any) {
        if (err.code === 'P2025') {
            logger.warn({ authId, id }, 'User not found during deletion');
            return res.status(404).json({ error: 'User not found' });
        }
        logger.error({ err, authId, id }, 'Database error during user deletion');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getMyUser = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: authId.toString() },
            include: {
                userImages: true,
            }

        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (err) {
        logger.error({ err, authId }, 'Database error during getMyUser');
        res.status(500).json({ error: 'Database error' });
    }
};



export const searchUsers = async (req: Request, res: Response) => {
    const query = req.query as any;
    const { name, specialties, location, role, verified, gender } = query;
    const page = parseInt((query.page as string) || '1');
    const pageSize = parseInt((query.pageSize as string) || '20');
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.UserWhereInput = {};

    if (name) {
        where.OR = [
            { firstName: { contains: name as string, mode: 'insensitive' } },
            { lastName: { contains: name as string, mode: 'insensitive' } }
        ];
    }

    if (specialties) {
        // Removed relation, maybe map to single specialization?
        // where.specialization = { contains: specialties as string, mode: 'insensitive' };
    }

    if (location) where.city = { contains: location as string, mode: 'insensitive' };
    if (role) where.role = role as any;
    if (verified !== undefined) where.verified = verified === 'true';
    if (gender) where.gender = { equals: gender as string, mode: 'insensitive' };

    try {
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        logger.info({ query, page, pageSize, total }, 'Fetched users search results');
        res.status(200).json({ users, page, pageSize, total });
    } catch (err) {
        logger.error({ err, query }, 'Database error during searchUsers');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    return searchUsers(req, res);
};

export const getUserById = async (req: Request, res: Response) => {
    const { id: paramId } = req.params as any;
    const id = paramId;

    try {
        const user = await prisma.user.findUnique({
            where: { id },

        });

        if (!user) {
            logger.warn({ id }, 'User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        logger.info({ id }, 'Fetched user by id');
        res.status(200).json(user);
    } catch (err) {
        logger.error({ err, id }, 'Database error during getUserById');
        res.status(500).json({ error: 'Database error' });
    }
};

// --- USER EXPERIENCE CONTROLLERS ---

export const createUserExperience = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    const {
        organizationName,
        role,
        title, // Fallback if role is missing
        startDate,
        start_date, // Support snake_case from frontend
        endDate,
        end_date, // Support snake_case from frontend
        description,
        locationType,
        country,
        city,
        isCurrentJob
    } = req.body;
    console.log("create experience", req.body)

    // Map fields
    const finalRole = role || title;
    const finalStartDate = startDate || start_date;
    const finalEndDate = endDate || end_date;

    try {
        const experience = await prisma.userExperiences.create({
            data: {
                userId: String(authId),
                organizationName,
                role: finalRole,
                startDate: new Date(finalStartDate),
                endDate: finalEndDate ? new Date(finalEndDate) : new Date(), // Handle nullable/current logic if needed, usually if isCurrentJob is true, endDate might be ignored or null in DB but schema has default(now())
                description,
                locationType,
                country,
                city,
                isCurrentJob: Boolean(isCurrentJob)
            }
        });
        logger.info({ authId, experienceId: experience.id }, 'User experience created');
        res.status(201).json(experience);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error creating user experience');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getUserExperiences = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const experiences = await prisma.userExperiences.findMany({
            where: { userId: String(authId) },
            orderBy: [
                { isCurrentJob: 'desc' },
                { startDate: 'desc' }
            ]
        });
        res.status(200).json(experiences);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching user experiences');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getCurrentOrganization = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Get the latest experience entry (prioritizing current jobs)
        const latestExperience = await prisma.userExperiences.findFirst({
            where: { userId: String(authId) },
            orderBy: [
                { isCurrentJob: 'desc' },
                { startDate: 'desc' }
            ]
        });

        if (!latestExperience) {
            return res.status(404).json({
                error: 'No experience found',
                organizationName: null,
                role: null
            });
        }

        res.status(200).json({
            organizationName: latestExperience.organizationName,
            role: latestExperience.role
        });
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching current organization');
        res.status(500).json({ error: 'Database error' });
    }
};

export const updateUserExperience = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const { id } = req.params as any; // experienceId
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Ownership check
        const existing = await prisma.userExperiences.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Experience not found' });
        if (existing.userId !== String(authId)) return res.status(403).json({ error: 'Forbidden' });

        const {
            organizationName,
            role,
            title,
            startDate,
            start_date,
            endDate,
            end_date,
            description,
            locationType,
            country,
            city,
            isCurrentJob
        } = req.body;

        const finalRole = role || title;
        const finalStartDate = startDate || start_date;
        const finalEndDate = endDate || end_date;

        const updateData: any = {};
        if (organizationName !== undefined) updateData.organizationName = organizationName;
        if (finalRole !== undefined) updateData.role = finalRole;
        if (finalStartDate !== undefined) updateData.startDate = new Date(finalStartDate);
        if (finalEndDate !== undefined) updateData.endDate = new Date(finalEndDate);
        if (description !== undefined) updateData.description = description;
        if (locationType !== undefined) updateData.locationType = locationType;
        if (country !== undefined) updateData.country = country;
        if (city !== undefined) updateData.city = city;
        if (isCurrentJob !== undefined) updateData.isCurrentJob = Boolean(isCurrentJob);

        const updated = await prisma.userExperiences.update({
            where: { id },
            data: updateData
        });
        logger.info({ authId, experienceId: id }, 'User experience updated');
        res.status(200).json(updated);
    } catch (err: any) {
        logger.error({ err, authId, id }, 'Error updating user experience');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserExperience = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const { id } = req.params as any;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const existing = await prisma.userExperiences.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Experience not found' });
        if (existing.userId !== String(authId)) return res.status(403).json({ error: 'Forbidden' });

        await prisma.userExperiences.delete({ where: { id } });
        logger.info({ authId, experienceId: id }, 'User experience deleted');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, authId, id }, 'Error deleting user experience');
        res.status(500).json({ error: 'Database error' });
    }
};

// --- USER EDUCATION CONTROLLERS ---

export const createUserEducation = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    const {
        instituteName,
        degree,
        startDate,
        start_date,
        endDate,
        end_date,
        country,
        city,
        isCurrentJob // Note: Schema uses isCurrentJob for Education too (meaning isCurrentEducation)
    } = req.body;

    const finalStartDate = startDate || start_date;
    const finalEndDate = endDate || end_date;

    try {
        const education = await prisma.userEducation.create({
            data: {
                userId: String(authId),
                instituteName,
                degree,
                startDate: new Date(finalStartDate),
                endDate: finalEndDate ? new Date(finalEndDate) : new Date(),
                country,
                city,
                isCurrentJob: Boolean(isCurrentJob)
            }
        });
        logger.info({ authId, educationId: education.id }, 'User education created');
        res.status(201).json(education);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error creating user education');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getUserEducation = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const education = await prisma.userEducation.findMany({
            where: { userId: String(authId) },
            orderBy: [
                { isCurrentJob: 'desc' },
                { startDate: 'desc' }
            ]
        });
        res.status(200).json(education);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching user education');
        res.status(500).json({ error: 'Database error' });
    }
};

export const updateUserEducation = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const { id } = req.params as any; // educationId
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const existing = await prisma.userEducation.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Education not found' });
        if (existing.userId !== String(authId)) return res.status(403).json({ error: 'Forbidden' });

        const {
            instituteName,
            degree,
            startDate,
            start_date,
            endDate,
            end_date,
            country,
            city,
            isCurrentJob
        } = req.body;

        const finalStartDate = startDate || start_date;
        const finalEndDate = endDate || end_date;

        const updateData: any = {};
        if (instituteName !== undefined) updateData.instituteName = instituteName;
        if (degree !== undefined) updateData.degree = degree;
        if (finalStartDate !== undefined) updateData.startDate = new Date(finalStartDate);
        if (finalEndDate !== undefined) updateData.endDate = new Date(finalEndDate);
        if (country !== undefined) updateData.country = country;
        if (city !== undefined) updateData.city = city;
        if (isCurrentJob !== undefined) updateData.isCurrentJob = Boolean(isCurrentJob);

        const updated = await prisma.userEducation.update({
            where: { id },
            data: updateData
        });
        logger.info({ authId, educationId: id }, 'User education updated');
        res.status(200).json(updated);
    } catch (err: any) {
        logger.error({ err, authId, id }, 'Error updating user education');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserEducation = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    const { id } = req.params as any;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const existing = await prisma.userEducation.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Education not found' });
        if (existing.userId !== String(authId)) return res.status(403).json({ error: 'Forbidden' });

        await prisma.userEducation.delete({ where: { id } });
        logger.info({ authId, educationId: id }, 'User education deleted');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, authId, id }, 'Error deleting user education');
        res.status(500).json({ error: 'Database error' });
    }
};

// --- USER SKILLS CONTROLLERS ---

export const updateUserSkills = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    const { skills } = req.body; // Expecting array of strings

    if (!Array.isArray(skills)) {
        return res.status(400).json({ error: 'Skills must be an array of strings' });
    }

    try {
        // Clean skills: trim and remove duplicates
        const cleanSkills = Array.from(new Set(skills.map((s: string) => s.trim()).filter((s: string) => s.length > 0)));

        // Check if skills record exists for this user
        const existing = await prisma.userSkills.findFirst({
            where: { userId: String(authId) }
        });

        let updatedSkills;

        if (existing) {
            // Update existing record
            updatedSkills = await prisma.userSkills.update({
                where: { id: existing.id },
                data: { skills: cleanSkills }
            });
        } else {
            // Create new record
            updatedSkills = await prisma.userSkills.create({
                data: {
                    userId: String(authId),
                    skills: cleanSkills
                }
            });
        }

        logger.info({ authId, skillsCount: cleanSkills.length }, 'User skills updated');
        res.status(200).json(updatedSkills);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error updating user skills');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getUserSkills = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const skillsRecord = await prisma.userSkills.findFirst({
            where: { userId: String(authId) }
        });

        // Return skills array or empty array if no record
        res.status(200).json(skillsRecord?.skills || []);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching user skills');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserSkills = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // We delete all records for completeness, although logicaly should be at most one
        await prisma.userSkills.deleteMany({
            where: { userId: String(authId) }
        });

        logger.info({ authId }, 'User skills deleted');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, authId }, 'Error deleting user skills');
        res.status(500).json({ error: 'Database error' });
    }
};

// --- USER SPECIALITIES CONTROLLERS ---

export const updateUserSpecialities = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    const { specialities } = req.body; // Expecting array of strings

    if (!Array.isArray(specialities)) {
        return res.status(400).json({ error: 'Specialities must be an array of strings' });
    }

    try {
        // Clean specialities: trim and remove duplicates
        const cleanSpecialities = Array.from(new Set(specialities.map((s: string) => s.trim()).filter((s: string) => s.length > 0)));

        // Check if specialities record exists for this user
        const existing = await prisma.userSpecialities.findFirst({
            where: { userId: String(authId) }
        });

        let updatedSpecialities;

        if (existing) {
            // Update existing record
            updatedSpecialities = await prisma.userSpecialities.update({
                where: { id: existing.id },
                data: { specialities: cleanSpecialities }
            });
        } else {
            // Create new record
            updatedSpecialities = await prisma.userSpecialities.create({
                data: {
                    userId: String(authId),
                    specialities: cleanSpecialities
                }
            });
        }

        logger.info({ authId, specialitiesCount: cleanSpecialities.length }, 'User specialities updated');
        res.status(200).json(updatedSpecialities);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error updating user specialities');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getUserSpecialities = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const specialitiesRecord = await prisma.userSpecialities.findFirst({
            where: { userId: String(authId) }
        });

        // Return specialities array or empty array if no record
        res.status(200).json(specialitiesRecord?.specialities || []);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching user specialities');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserSpecialities = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // We delete all records for completeness, although logicaly should be at most one
        await prisma.userSpecialities.deleteMany({
            where: { userId: String(authId) }
        });

        logger.info({ authId }, 'User specialities deleted');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, authId }, 'Error deleting user specialities');
        res.status(500).json({ error: 'Database error' });
    }
};

// --- USER LINKS CONTROLLERS ---

export const updateUserLinks = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    const { links } = req.body; // Expecting array of strings

    if (!Array.isArray(links)) {
        return res.status(400).json({ error: 'Links must be an array of strings' });
    }

    try {
        // Clean links: trim and remove duplicates
        const cleanLinks = Array.from(new Set(links.map((s: string) => s.trim()).filter((s: string) => s.length > 0)));

        // Check if links record exists for this user
        const existing = await prisma.userLinks.findFirst({
            where: { userId: String(authId) }
        });

        let updatedLinks;

        if (existing) {
            // Update existing record
            updatedLinks = await prisma.userLinks.update({
                where: { id: existing.id },
                data: { links: cleanLinks }
            });
        } else {
            // Create new record
            updatedLinks = await prisma.userLinks.create({
                data: {
                    userId: String(authId),
                    links: cleanLinks
                }
            });
        }

        logger.info({ authId, linksCount: cleanLinks.length }, 'User links updated');
        res.status(200).json(updatedLinks);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error updating user links');
        res.status(500).json({ error: 'Database error' });
    }
};

export const getUserLinks = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const linksRecord = await prisma.userLinks.findFirst({
            where: { userId: String(authId) }
        });

        // Return links array or empty array if no record
        res.status(200).json(linksRecord?.links || []);
    } catch (err: any) {
        logger.error({ err, authId }, 'Error fetching user links');
        res.status(500).json({ error: 'Database error' });
    }
};

export const deleteUserLinks = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;
    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // We delete all records for completeness, although logicaly should be at most one
        await prisma.userLinks.deleteMany({
            where: { userId: String(authId) }
        });

        logger.info({ authId }, 'User links deleted');
        res.status(204).send();
    } catch (err: any) {
        logger.error({ err, authId }, 'Error deleting user links');
        res.status(500).json({ error: 'Database error' });
    }
};


export const checkUserProfileCompletionStatus = async (req: AuthRequest, res: Response) => {
    const authId = req.user?.id;

    if (!authId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const user = await prisma.user.findUnique({
            where: { id: String(authId) },
            include: {
                userSpecialities: true,
                userExperiences: true,
                skills: true,
                userEducations: true,
                userVerifications: true
            }
        });

        if (!user) {
            logger.error({ authId }, 'User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        const isStudent = user.role === 'STUDENT';
        const isVerified = user.userVerifications.some((v: any) => v.status === 'APPROVED');

        // console.log("is user verified", user.userVerifications, isVerified);

        if (!isVerified) {
            return res.status(400).json({
                isComplete: false,
                error: "Not Verified. Please verify your profile before applying."
            });
        }

        if (isStudent) {
            // Students: Education, Skills, and Specialities required
            if (
                user.userEducations.length === 0 ||
                user.skills.length === 0 ||
                user.userSpecialities.length === 0
            ) {
                return res.status(400).json({
                    isComplete: false,
                    error: "Profile incomplete. Please complete your education, skills, and speciality before applying."
                });
            }
        } else {
            // Non-students: Education, Experience, Skills, and Specialities required
            if (
                user.userEducations.length === 0 ||
                user.userExperiences.length === 0 ||
                user.skills.length === 0 ||
                user.userSpecialities.length === 0
            ) {
                return res.status(400).json({
                    isComplete: false,
                    error: "Profile incomplete. Please add your experience, education, skills, and speciality details before applying."
                });
            }
        }

        return res.status(200).json({
            isComplete: true
        });
    } catch (err: any) {
        logger.error({ err, authId }, 'Error checking user profile completion status');
        res.status(500).json({ error: 'Database error' });
    }
};