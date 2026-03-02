import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "../system/storage";
import { appConfig } from "../../core/config";

type SessionClaims = {
  sub: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
  exp?: number;
};

type SessionUser = {
  claims: SessionClaims;
  expires_at: number;
};

declare module "express-session" {
  interface SessionData {
    authUser?: SessionUser;
  }
}

const LOCAL_ADMIN_EMAIL = "admin@local.dev";
const ADMIN_PROFILE_NAME = "Administrador";
const ADMIN_PROFILE_PERMISSIONS = [
  "users.view",
  "users.edit",
  "users.delete",
  "profiles.view",
  "profiles.edit",
  "plans.view",
  "plans.edit",
  "artifacts.generate",
  "artifacts.export",
];
const sessionTtlMs = Math.max(1, appConfig.sessionTtlDays) * 24 * 60 * 60 * 1000;

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: appConfig.databaseUrl,
    createTableIfMissing: true,
    ttl: sessionTtlMs,
    tableName: "sessions",
  });

  return session({
    secret: appConfig.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: appConfig.sessionCookieSecure,
      sameSite: "lax",
      maxAge: sessionTtlMs,
    },
  });
}

async function ensureAdminProfile() {
  let adminProfile = await storage.getProfileByName(ADMIN_PROFILE_NAME);
  if (!adminProfile) {
    adminProfile = await storage.createProfile({
      name: ADMIN_PROFILE_NAME,
      description: "Acesso completo ao sistema.",
      permissions: ADMIN_PROFILE_PERMISSIONS,
      isSystem: true,
    });
  }

  return adminProfile;
}

async function ensureLocalAdminPrivileges(userId: string, email: string) {
  if (email.trim().toLowerCase() !== LOCAL_ADMIN_EMAIL) {
    return;
  }

  const adminProfile = await ensureAdminProfile();
  const currentUser = await storage.getUser(userId);

  if (!currentUser || currentUser.profileId !== adminProfile.id) {
    await storage.updateUser(userId, { profileId: adminProfile.id });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.use((req, _res, next) => {
    if (req.session?.authUser) {
      (req as any).user = req.session.authUser;
    }
    next();
  });

  app.get("/api/login", (req, res) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(`/login${query}`);
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    const localAuthCredentials = {
      email: appConfig.authLocalEmail,
      password: appConfig.authLocalPassword,
      firstName: appConfig.authLocalFirstName,
      lastName: appConfig.authLocalLastName,
    };
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const expectedEmail = localAuthCredentials.email.toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    if (normalizedEmail !== expectedEmail || password !== localAuthCredentials.password) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    let user = await storage.getUserByEmail(normalizedEmail);

    if (!user) {
      user = await storage.createManualUser({
        email: normalizedEmail,
        firstName: localAuthCredentials.firstName,
        lastName: localAuthCredentials.lastName,
      });
    }

    await ensureLocalAdminPrivileges(user.id, normalizedEmail);
    user = (await storage.getUser(user.id)) ?? user;

    const expiresAt = Math.floor((Date.now() + sessionTtlMs) / 1000);
    const sessionUser: SessionUser = {
      claims: {
        sub: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        profile_image_url: user.profileImageUrl,
        exp: expiresAt,
      },
      expires_at: expiresAt,
    };

    req.session.authUser = sessionUser;

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  });

  const logoutHandler = (req: any, res: any) => {
    req.session?.destroy(() => {
      res.clearCookie("connect.sid", {
        path: "/",
        httpOnly: true,
        secure: appConfig.sessionCookieSecure,
        sameSite: "lax",
      });
      return res.redirect("/login");
    });
  };

  app.get("/api/logout", logoutHandler);
  app.get("/api/auth/logout", logoutHandler);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.session?.authUser;

  if (!user?.claims?.sub || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    req.session.authUser = undefined;
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = user;
  next();
};
