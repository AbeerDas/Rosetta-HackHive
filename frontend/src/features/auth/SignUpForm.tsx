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
  LinearProgress,
} from "@mui/material";
import { Visibility, VisibilityOff, Check, Close } from "@mui/icons-material";
import { useAuthActions } from "@convex-dev/auth/react";

interface SignUpFormProps {
  onSuccess: (email: string) => void;
  onSwitchToSignIn: () => void;
}

interface PasswordStrength {
  score: number;
  hasLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
}

function checkPasswordStrength(password: string): PasswordStrength {
  const hasLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  const score = [hasLength, hasLowercase, hasUppercase, hasNumber].filter(
    Boolean
  ).length;

  return { score, hasLength, hasLowercase, hasUppercase, hasNumber };
}

function PasswordRequirement({
  met,
  text,
}: {
  met: boolean;
  text: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {met ? (
        <Check sx={{ fontSize: 16, color: "success.main" }} />
      ) : (
        <Close sx={{ fontSize: 16, color: "text.disabled" }} />
      )}
      <Typography
        variant="caption"
        color={met ? "success.main" : "text.secondary"}
      >
        {text}
      </Typography>
    </Box>
  );
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const { signIn } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = checkPasswordStrength(password);
  const isPasswordValid = strength.score === 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("Please meet all password requirements");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", "signUp");

      await signIn("password", formData);
      onSuccess(email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      if (message.includes("already exists")) {
        setError("An account with this email already exists");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (strength.score <= 1) return "error";
    if (strength.score <= 2) return "warning";
    if (strength.score <= 3) return "info";
    return "success";
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Name"
        type="text"
        fullWidth
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
        sx={{ mb: 2 }}
      />

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
        autoComplete="new-password"
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

      {password && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={(strength.score / 4) * 100}
            color={getStrengthColor()}
            sx={{ mb: 1, height: 6, borderRadius: 3 }}
          />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <PasswordRequirement
              met={strength.hasLength}
              text="8+ characters"
            />
            <PasswordRequirement
              met={strength.hasLowercase}
              text="Lowercase"
            />
            <PasswordRequirement
              met={strength.hasUppercase}
              text="Uppercase"
            />
            <PasswordRequirement met={strength.hasNumber} text="Number" />
          </Box>
        </Box>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || !isPasswordValid}
        sx={{
          mb: 3,
          py: 1.5,
          textTransform: "none",
          fontSize: "1rem",
        }}
      >
        {loading ? "Creating account..." : "Create account"}
      </Button>

      <Typography variant="body2" textAlign="center">
        Already have an account?{" "}
        <Link
          component="button"
          type="button"
          onClick={onSwitchToSignIn}
          sx={{ cursor: "pointer" }}
        >
          Sign in
        </Link>
      </Typography>
    </Box>
  );
}
