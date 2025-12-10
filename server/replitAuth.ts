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

// Check if user is an admin/operational user (created by admin in users table)
async function isOperationalUser(claims: any): Promise<boolean> {
  const user = await storage.getUser(claims["sub"]);
  // Operational users have a profile assigned (admin creates them with profiles)
  return user !== undefined && user !== null && user.profileId !== null;
}

// Upsert user only for operational users (admin-created)
async function upsertOperationalUser(claims: any) {
  const existingUser = await storage.getUser(claims["sub"]);
  if (existingUser && existingUser.profileId) {
    // Update existing operational user
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
  }
}

// Create or get client for public registration flow
// Returns { client, isNew, registrationComplete }
async function createOrGetClient(claims: any, selectedPlanSlug?: string): Promise<{ client: any; isNew: boolean; registrationComplete: boolean }> {
  const email = claims["email"];
  const userId = claims["sub"];
  
  if (!email) {
    throw new Error("Email is required for client registration");
  }

  // Check if client already exists by userId or email
  let existingClient = await storage.getClientByUserId(userId);
  if (!existingClient) {
    existingClient = await storage.getClientByEmail(email);
  }
  
  if (existingClient) {
    // Update userId if not set
    if (!existingClient.userId) {
      await storage.updateClient(existingClient.id, { userId });
    }
    return { 
      client: existingClient, 
      isNew: false, 
      registrationComplete: existingClient.registrationComplete || false 
    };
  }

  // Create new client record with minimal data
  // Full registration (name, CPF, address) will be completed in a separate step
  const clientName = `${claims["first_name"] || ""} ${claims["last_name"] || ""}`.trim() || email;
  const newClient = await storage.createClient({
    userId,
    name: clientName,
    email: email,
    cpf: null, // Will be filled during registration completion
    phone: null,
    address: null,
    registrationComplete: false,
  });

  // Find the selected plan or default to free
  const plans = await storage.getPlans();
  let selectedPlan = plans.find(p => p.slug === selectedPlanSlug);
  if (!selectedPlan) {
    selectedPlan = plans.find(p => p.slug === "free");
  }

  if (selectedPlan) {
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

  return { client: newClient, isNew: true, registrationComplete: false };
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
    // User/Client creation is now handled in the callback handler
    // to properly separate clients (public) from users (admin-created)
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
      prompt: "login",
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
      
      try {
        // Check if this is an operational user (admin-created)
        const isOpUser = await isOperationalUser(user.claims);
        
        if (isOpUser) {
          // Update operational user data
          await upsertOperationalUser(user.claims);
          req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            return res.redirect("/dashboard");
          });
        } else {
          // Public registration flow - use clients table only
          const { registrationComplete } = await createOrGetClient(user.claims, selectedPlanSlug);
          
          req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            // Redirect to complete registration if not done
            if (!registrationComplete) {
              return res.redirect("/completar-cadastro");
            }
            return res.redirect("/dashboard");
          });
        }
      } catch (error) {
        console.error("Error in authentication callback:", error);
        return res.redirect("/api/login");
      }
    })(req, res, next);
  });

  // Logout endpoint - properly ends session and allows choosing different account
  app.get("/api/logout", (req, res) => {
    const hostname = req.hostname;
    
    // Clear all session data and cookies
    req.logout(() => {
      // Destroy the session completely
      req.session?.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        
        // Clear the session cookie
        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          secure: true,
        });
        
        // Redirect to OIDC end session endpoint with prompt to select account
        // Using id_token_hint if available to properly end the session
        const endSessionUrl = client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `https://${hostname}`,
        });
        
        res.redirect(endSessionUrl.href);
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
