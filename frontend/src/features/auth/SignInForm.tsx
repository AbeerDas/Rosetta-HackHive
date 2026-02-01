import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Link,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuthActions } from "@convex-dev/auth/react";

interface SignInFormProps {
  onForgotPassword: () => void;
  onSwitchToSignUp: () => void;
  onVerificationNeeded?: (email: string) => void;
}

export function SignInForm({
  onForgotPassword,
  onSwitchToSignUp,
  onVerificationNeeded,
}: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", "signIn");

      const result = await signIn("password", formData);
      
      // If signIn returns false, user needs email verification
      if (result === false && onVerificationNeeded) {
        onVerificationNeeded(email);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      if (message.includes("verify") && onVerificationNeeded) {
        onVerificationNeeded(email);
      } else {
        setError(message === "Could not verify credentials" 
          ? "Invalid email or password" 
          : message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Email"
        type="email"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Password"
        type={showPassword ? "text" : "password"}
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 1 }}
      />

      <Box sx={{ textAlign: "right", mb: 2 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={onForgotPassword}
          sx={{ cursor: "pointer" }}
        >
          Forgot your password?
        </Link>
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ 
          mb: 3, 
          py: 1.5,
          textTransform: "none",
          fontSize: "1rem",
        }}
      >
        {loading ? "Signing in..." : "Sign in"}
      </Button>

      <Typography variant="body2" textAlign="center">
        Don't have an account?{" "}
        <Link
          component="button"
          type="button"
          onClick={onSwitchToSignUp}
          sx={{ cursor: "pointer" }}
        >
          Sign up
        </Link>
      </Typography>
    </Box>
  );
}
