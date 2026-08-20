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
  changePassword,
  deactivateAccount,
  revokeOtherSessions,
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
router.put("/change-password", protect, changePassword);
router.post("/deactivate", protect, deactivateAccount);
router.post("/sessions/revoke-others", protect, revokeOtherSessions);
router.post("/logout", protect, logout);

// Addresses moved to their own resource — see routes/addressRoutes.js,
// mounted at /api/v1/addresses.

export default router;
