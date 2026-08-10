import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  signup,
  verifySignupOTP,
  login,
  requestPasswordReset,
  resetPassword,
  getMe,
  updateProfile,
  addAddress,
  logout,
  refreshToken,
} from "../controllers/authController.js";

const router = Router();

router.post("/signup", signup);
router.post("/signup/verify-otp", verifySignupOTP);
router.post("/login", login);
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/verify-otp", resetPassword);
router.post("/refresh-token", refreshToken);

router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.post("/address", protect, addAddress);
router.post("/logout", protect, logout);

export default router;
