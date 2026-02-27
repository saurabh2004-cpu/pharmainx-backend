import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from '../lib/prisma.js';


export const signUp = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (admin) {
            return res.status(400).json({ message: "Admin already exists" });
        }
        const newAdmin = await prisma.admin.create({ data: { email, password } });

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
        const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET!, { expiresIn: "1h" });
        res.status(200)
            .cookie("adminAccessToken", token, {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                maxAge: 60 * 60 * 1000
            })
            .json({ message: "Admin logged in successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const logout = async (req: Request, res: Response) => {
    try {
        res.status(200)
            .clearCookie("adminAccessToken", {
                httpOnly: true,
                secure: true,
                sameSite: "strict"
            })
            .json({ message: "Admin logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}
