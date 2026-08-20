import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController.js";

const router = Router();

// Every route requires auth, and every controller scopes its query to
// req.user._id — a customer can never read/modify another customer's
// address by guessing/supplying a different :id.
router.use(protect);

router.get("/", getAddresses);
router.post("/", createAddress);
router.get("/:id", getAddressById);
router.patch("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.patch("/:id/default", setDefaultAddress);

export default router;
