const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const RefreshToken = require("../models/RefreshToken");
const SavedItem = require("../models/SavedItem");
const User = require("../models/User");

const router = express.Router();
const COUNTRY_TEXT_REGEX = /^[A-Za-z][A-Za-z\s\-']{1,55}$/;
const PHONE_ALLOWED_CHARS_REGEX = /^[0-9()\-\s]+$/;
const ALLOWED_PHONE_CODES = new Set([
  "+1", "+44", "+91", "+61", "+49", "+33", "+34", "+39", "+31", "+46",
  "+47", "+45", "+41", "+353", "+351", "+52", "+55", "+54", "+56", "+57",
  "+51", "+27", "+20", "+234", "+254", "+971", "+966", "+974", "+90", "+972",
  "+92", "+880", "+94", "+977", "+86", "+81", "+82", "+65", "+60", "+66",
  "+62", "+63", "+84", "+64",
]);

function validateProfileInput({ phone, country }) {
  const cleanPhone = String(phone || "").trim().replace(/\s+/g, " ");
  const cleanCountry = String(country || "").trim();
  if (!cleanPhone || !cleanCountry) {
    return { ok: false, message: "Phone and country are required" };
  }
  if (!COUNTRY_TEXT_REGEX.test(cleanCountry)) {
    return { ok: false, message: "Please provide a valid country" };
  }
  const [code, ...rest] = cleanPhone.split(" ");
  if (!/^\+\d{1,4}$/.test(code)) {
    return { ok: false, message: "Phone country code must be in +NNN format" };
  }
  if (!ALLOWED_PHONE_CODES.has(code)) {
    return { ok: false, message: "Please select a supported country code" };
  }
  const phoneNumber = rest.join(" ").trim();
  if (!phoneNumber) {
    return { ok: false, message: "Phone number is required" };
  }
  if (!PHONE_ALLOWED_CHARS_REGEX.test(phoneNumber)) {
    return { ok: false, message: "Phone number can contain only digits, spaces, (), and -" };
  }
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  if (digitsOnly.length < 6 || digitsOnly.length > 15) {
    return { ok: false, message: "Phone number must contain 6 to 15 digits" };
  }
  return { ok: true, cleanPhone, cleanCountry };
}

function buildUserResponse(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    photoUrl: user.avatarUrl,
    provider: user.provider,
    phone: user.phone || "",
    country: user.country || "",
    profileComplete: !!user.profileComplete,
    createdAt: user.createdAt,
  };
}

router.get("/me", authMiddleware, async (req, res) => {
  const user = req.user;
  return res.json({
    user: buildUserResponse(user),
  });
});

router.patch("/me/profile", authMiddleware, async (req, res) => {
  const validation = validateProfileInput(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  req.user.phone = validation.cleanPhone;
  req.user.country = validation.cleanCountry;
  req.user.profileComplete = true;
  await req.user.save();

  return res.json({
    user: buildUserResponse(req.user),
  });
});

router.patch("/me/avatar", authMiddleware, async (req, res) => {
  const cleanAvatarUrl = String(req.body?.avatarUrl || "").trim();
  if (!cleanAvatarUrl) {
    return res.status(400).json({ message: "Avatar image is required." });
  }
  if (!cleanAvatarUrl.startsWith("data:image/")) {
    return res.status(400).json({ message: "Avatar must be a valid image data URI." });
  }

  req.user.avatarUrl = cleanAvatarUrl;
  req.user.avatarSource = "custom";
  await req.user.save();

  return res.json({
    user: buildUserResponse(req.user),
  });
});

router.delete("/me", authMiddleware, async (req, res) => {
  const userId = req.user._id;
  await Promise.all([
    SavedItem.deleteMany({ userId }),
    RefreshToken.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
  return res.json({ ok: true });
});

module.exports = router;
