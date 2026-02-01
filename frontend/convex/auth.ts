import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";
import { ConvexError } from "convex/values";

// Custom password provider with validation
// Note: Email verification temporarily disabled - will add back with action-based approach
const CustomPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: params.name as string,
    };
  },
  validatePasswordRequirements: (password: string) => {
    if (password.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }
    if (!/[a-z]/.test(password)) {
      throw new ConvexError("Password must contain a lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      throw new ConvexError("Password must contain an uppercase letter");
    }
    if (!/\d/.test(password)) {
      throw new ConvexError("Password must contain a number");
    }
  },
  // verify and reset will be added later with proper Convex actions
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub,
    Google,
    Apple,
    CustomPassword,
  ],
});
