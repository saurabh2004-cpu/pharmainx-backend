import { Router } from 'express';
import {
    updateUser,
    deleteUser,
    getMyUser,
    searchUsers,
    getAllUsers,
    getUserById,
    SignupUser,
    signInUser,
    createUserExperience,
    getUserExperiences,
    getCurrentOrganization,
    updateUserExperience,
    deleteUserExperience,
    createUserEducation,
    getUserEducation,
    updateUserEducation,
    deleteUserEducation,
    updateUserSkills,
    getUserSkills,
    deleteUserSkills,
    updateUserSpecialities,
    getUserSpecialities,
    deleteUserSpecialities,
    updateUserLinks,
    getUserLinks,
    deleteUserLinks,
    checkUserProfileCompletionStatus
} from '../controllers/user.controller.js';
import { downloadResume } from '../controllers/resume.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Public Routes
router.get('/search-users', searchUsers);
router.get('/get-all-users', getAllUsers);
router.get('/get-user/:id', getUserById);
router.get('/resume/download/:userId', authenticateToken, downloadResume);

// Private Routes (Apply Auth Middleware)
router.post('/create-user', SignupUser);
router.post('/signin-user', signInUser);
router.get('/my-profile', authenticateToken, getMyUser);
router.put('/update-user/:id', authenticateToken, updateUser);
router.delete('/delete-user/:id', authenticateToken, deleteUser);

// Experience Routes
router.post('/create-experience', authenticateToken, createUserExperience);
router.get('/get-experience', authenticateToken, getUserExperiences);
router.get('/get-current-organization', authenticateToken, getCurrentOrganization);
router.put('/update-experience/:id', authenticateToken, updateUserExperience);
router.delete('/delete-experience/:id', authenticateToken, deleteUserExperience);

// Education Routes
router.post('/create-education', authenticateToken, createUserEducation);
router.get('/get-education', authenticateToken, getUserEducation);
router.put('/update-education/:id', authenticateToken, updateUserEducation);
router.delete('/delete-education/:id', authenticateToken, deleteUserEducation);

// Skills Routes
router.post('/create-skills', authenticateToken, updateUserSkills);
router.get('/get-skills', authenticateToken, getUserSkills);
router.delete('/delete-skills', authenticateToken, deleteUserSkills);

// Specialities Routes
router.post('/create-specialities', authenticateToken, updateUserSpecialities);
router.get('/get-specialities', authenticateToken, getUserSpecialities);
router.delete('/delete-specialities', authenticateToken, deleteUserSpecialities);

// Links Routes
router.post('/create-links', authenticateToken, updateUserLinks);
router.get('/get-links', authenticateToken, getUserLinks);
router.delete('/delete-links', authenticateToken, deleteUserLinks);

// Profile Completion Routes
router.get('/check-profile-completion', authenticateToken, checkUserProfileCompletionStatus);

export default router;
