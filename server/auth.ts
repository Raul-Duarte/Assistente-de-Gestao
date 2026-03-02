import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getLocalAuthConfig() {
  return {
    email: process.env.LOCAL_AUTH_EMAIL ?? "admin@local.dev",
    password: process.env.LOCAL_AUTH_PASSWORD ?? "admin123",
    firstName: process.env.LOCAL_AUTH_FIRST_NAME ?? "Admin",
    lastName: process.env.LOCAL_AUTH_LAST_NAME ?? "Local",
  };
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: SESSION_TTL_MS,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET ?? "local-dev-session-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
    },
  });
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
    const localAuth = getLocalAuthConfig();

    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios" });
    }

    if (email !== localAuth.email || password !== localAuth.password) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    let user = await storage.getUserByEmail(email);

    if (!user) {
      user = await storage.createManualUser({
        email,
        firstName: localAuth.firstName,
        lastName: localAuth.lastName,
      });
    }

    const expiresAt = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
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
        secure: process.env.NODE_ENV === "production",
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
