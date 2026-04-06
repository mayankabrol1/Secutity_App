const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const bcrypt = require("bcryptjs");

const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/tokens");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getGoogleAudiences() {
  const configured = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(configured)];
}

function getUserPayload(user) {
  const hasGoogle = !!user.providerUserId && !String(user.providerUserId).startsWith("pwd:");
  const hasPassword = !!user.passwordHash;
  const provider = hasGoogle && hasPassword ? "mixed" : hasGoogle ? "google" : "password";
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    photoUrl: user.avatarUrl,
    provider,
    phone: user.phone || "",
    country: user.country || "",
    profileComplete: !!user.profileComplete,
  };
}

async function issueTokens(user, req) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const refreshPayload = verifyRefreshToken(refreshToken);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(refreshPayload.exp * 1000),
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip || "",
  });

  return { accessToken, refreshToken };
}

router.post("/google/callback", async (req, res) => {
  try {
    const { idToken, intent } = req.body || {};
    if (!idToken) return res.status(400).json({ message: "Missing idToken" });
    const authIntent = intent === "signup" ? "signup" : "signin";
    const audiences = getGoogleAudiences();
    if (audiences.length === 0) {
      return res.status(500).json({ message: "Google auth audience is not configured" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      return res.status(400).json({ message: "Invalid Google token payload" });
    }

    let user = await User.findOne({ providerUserId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email.toLowerCase() });
    }

    if (!user) {
      user = await User.create({
        email: payload.email.toLowerCase(),
        name: payload.name || "User",
        avatarUrl: payload.picture || "",
        avatarSource: payload.picture ? "google" : "none",
        provider: "google",
        providerUserId: payload.sub,
        profileComplete: false,
      });
    } else {
      if (authIntent === "signup") {
        return res.status(409).json({ message: "Account already exists. Please sign in." });
      }
      if (
        user.providerUserId &&
        !String(user.providerUserId).startsWith("pwd:") &&
        user.providerUserId !== payload.sub
      ) {
        return res.status(409).json({ message: "This email is already linked to a different Google account." });
      }
      user.providerUserId = payload.sub;
      user.name = payload.name || user.name;
      if (user.avatarSource !== "custom") {
        user.avatarUrl = payload.picture || user.avatarUrl;
        if (payload.picture) user.avatarSource = "google";
      }
      user.email = payload.email.toLowerCase();
      user.provider = user.passwordHash ? "mixed" : "google";
      await user.save();
    }

    const tokens = await issueTokens(user, req);
    return res.json({ user: getUserPayload(user), ...tokens });
  } catch (error) {
    return res.status(401).json({ message: "Google authentication failed" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, avatarUrl, phone, country } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    const cleanAvatarUrl = String(avatarUrl || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanCountry = String(country || "").trim();

    if (!cleanName || !cleanEmail || !cleanPassword || !cleanPhone || !cleanCountry) {
      return res.status(400).json({ message: "Name, email, password, phone and country are required." });
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    let user = await User.findOne({ email: cleanEmail });
    if (user && user.passwordHash) {
      return res.status(409).json({ message: "Account already exists. Please sign in." });
    }

    if (!user) {
      user = await User.create({
        email: cleanEmail,
        name: cleanName,
        avatarUrl: cleanAvatarUrl,
        avatarSource: cleanAvatarUrl ? "custom" : "none",
        passwordHash,
        providerUserId: `pwd:${cleanEmail}`,
        phone: cleanPhone,
        country: cleanCountry,
        profileComplete: true,
        provider: "password",
      });
    } else {
      user.name = cleanName || user.name;
      user.avatarUrl = cleanAvatarUrl || user.avatarUrl;
      if (cleanAvatarUrl) user.avatarSource = "custom";
      user.passwordHash = passwordHash;
      user.phone = cleanPhone;
      user.country = cleanCountry;
      user.profileComplete = true;
      user.provider = user.providerUserId ? "mixed" : "password";
      await user.save();
    }

    const tokens = await issueTokens(user, req);
    return res.json({ user: getUserPayload(user), ...tokens });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This email is already in use. Please sign in instead." });
    }
    return res.status(500).json({ message: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({
        message: "No account found for this email. Please sign up first.",
      });
    }
    if (!user.passwordHash) {
      return res.status(404).json({
        message: "This email was used to sign up with Google. Please sign in with Google.",
      });
    }

    const isValid = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    const tokens = await issueTokens(user, req);
    return res.json({ user: getUserPayload(user), ...tokens });
  } catch (error) {
    return res.status(500).json({ message: "Could not sign in" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: "Missing refreshToken" });

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ tokenHash, revokedAt: null });
    if (!stored) return res.status(401).json({ message: "Refresh token not recognized" });
    if (stored.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "User not found" });

    stored.revokedAt = new Date();
    await stored.save();

    const nextTokens = await issueTokens(user, req);
    return res.json({ user: getUserPayload(user), ...nextTokens });
  } catch (error) {
    return res.status(401).json({ message: "Could not refresh session" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ message: "Missing refreshToken" });

    const tokenHash = hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed" });
  }
});

module.exports = router;
