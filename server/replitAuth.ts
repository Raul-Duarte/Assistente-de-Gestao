import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

async function createClientAndSubscription(claims: any, selectedPlanSlug?: string) {
  const email = claims["email"];
  if (!email) return;

  // Check if client already exists
  const existingClient = await storage.getClientByEmail(email);
  if (existingClient) return;

  // Get user record
  const user = await storage.getUser(claims["sub"]);
  if (!user) return;

  // Create client record
  const clientName = `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || email;
  const newClient = await storage.createClient({
    name: clientName,
    email: email,
    cpf: `temp-${Date.now()}`, // Temporary CPF, user should update later
    phone: null,
    address: null,
  });

  // Find the selected plan or default to free
  const plans = await storage.getPlans();
  let selectedPlan = plans.find(p => p.slug === selectedPlanSlug);
  if (!selectedPlan) {
    selectedPlan = plans.find(p => p.slug === "free");
  }

  if (selectedPlan) {
    // Assign plan to user
    await storage.updateUser(user.id, { planId: selectedPlan.id });

    // Create subscription for the client
    const now = new Date();
    const subscription = await storage.createSubscription({
      clientId: newClient.id,
      planId: selectedPlan.id,
      startDate: now,
      billingDay: now.getDate() > 28 ? 28 : now.getDate(),
      status: "ativa",
    });

    // Create first invoice (auto-approved for now)
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await storage.createInvoice({
      subscriptionId: subscription.id,
      clientId: newClient.id,
      amount: selectedPlan.price || 0,
      dueDate: now,
      status: selectedPlan.price === 0 ? "paga" : "pendente", // Free plan is auto-paid
      referenceMonth,
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Store selected plan in session for use after callback
    const planSlug = req.query.plan as string;
    if (planSlug && req.session) {
      (req.session as any).selectedPlanSlug = planSlug;
    }
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    
    // Get selected plan from session
    const selectedPlanSlug = (req.session as any)?.selectedPlanSlug;
    
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.redirect("/api/login");
      
      // Clear the selected plan from session
      if (selectedPlanSlug) {
        delete (req.session as any).selectedPlanSlug;
      }
      
      // Create client and subscription if this is a new user
      try {
        await createClientAndSubscription(user.claims, selectedPlanSlug);
      } catch (error) {
        console.error("Error creating client/subscription:", error);
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.redirect("/dashboard");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `https://${req.hostname}`,
          }).href
        );
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
