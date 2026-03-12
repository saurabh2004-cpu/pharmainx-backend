import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from "../middlewares/auth.middleware.js";
import logger from "../lib/logging-client.js";


export const signUp = async (req: Request, res: Response) => {
    try {
        const { email, password, role } = req.body;

        console.log("role in admin controller", role)

        const admin = await prisma.admin.findUnique({ where: { email } });
        if (admin) {
            return res.status(400).json({ message: "Admin already exists" });
        }
        const newAdmin = await prisma.admin.create({ data: { email, password, role } });

        if (!newAdmin) {
            return res.status(500).json({ message: "Internal server error" });
        }

        res.status(200).json({ "message": "Admin created successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        const isPasswordValid = password === admin.password;
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid password" });
        }
        const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET!, { expiresIn: "1d" });
        res
            .status(200)
            .cookie("adminAccessToken", token, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: 24 * 60 * 60 * 1000
            })
            .json({
                message: "Admin logged in successfully",
                user: admin
            });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const logout = async (req: Request, res: Response) => {
    try {
        res.status(200)
            .clearCookie("adminAccessToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production" ? req.protocol === "https" : false,
                sameSite: "lax"
            })
            .json({ message: "Admin logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getAdminById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {

        if (!id) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const admin = await prisma.admin.findUnique({
            where: { id: id.toString() },
        });

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        logger.info({ id: admin.id, role: admin.role }, 'Fetched admin profile');
        res.status(200).json({
            profile: admin,
            role: admin.role,
        });


    } catch (error) {
        logger.error({ err: error }, 'Error fetching admin profile');
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const editAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { email, password, role } = req.body;
        const admin = await prisma.admin.findUnique({ where: { id: id.toString() } });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        await prisma.admin.update({
            where: { id: id.toString() },
            data: { email, password, role }
        });
        res.status(200).json({ message: "Admin updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const deleteAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const admin = await prisma.admin.findUnique({ where: { id: id.toString() } });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }
        await prisma.admin.delete({
            where: { id: id.toString() },
        });
        res.status(200).json({ message: "Admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getAllAdmins = async (req: AuthRequest, res: Response) => {
    try {
        const admins = await prisma.admin.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ data: admins });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching admins');
        res.status(500).json({ message: "Internal server error" });
    }
}


export const getStats = async (req: AuthRequest, res: Response) => {
    try {
        const [usersCount, jobsCount, applicationsCount, institutesCount] = await Promise.all([
            prisma.user.count(),
            prisma.job.count(),
            prisma.application.count(),
            prisma.institute.count()
        ])


        const stats = {
            usersCount,
            jobsCount,
            applicationsCount,
            institutesCount
        };

        if (!stats) {
            return res.status(500).json("error whicle fetching stats")
        }

        res.status(200).json(stats)

    } catch (error) {

    }
}