import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useAuthActions } from "@convex-dev/auth/react";

interface PasswordResetProps {
  email?: string;
  isVerifying?: boolean;
  onSuccess?: (email: string) => void;
  onBack: () => void;
}

export function PasswordReset({
  email: initialEmail = "",
  isVerifying = false,
  onSuccess,
  onBack,
}: PasswordResetProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("flow", "reset");

      await signIn("password", formData);
      
      if (onSuccess) {
        onSuccess(email);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset code";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email || initialEmail);
      formData.set("code", code);
      formData.set("newPassword", newPassword);
      formData.set("flow", "reset-verification");

      await signIn("password", formData);
      // Success - user will be signed in with new password
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      if (message.includes("expired")) {
        setError("Reset code has expired. Please request a new one.");
      } else if (message.includes("invalid") || message.includes("Invalid")) {
        setError("Invalid reset code");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request reset code
  if (!isVerifying) {
    return (
      <Box component="form" onSubmit={handleRequestReset}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Enter your email address and we'll send you a code to reset your
          password.
        </Typography>

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
          sx={{ mb: 3 }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            mb: 2,
            py: 1.5,
            textTransform: "none",
            fontSize: "1rem",
          }}
        >
          {loading ? "Sending..." : "Send reset code"}
        </Button>

        <Box sx={{ textAlign: "center" }}>
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={onBack}
            sx={{ cursor: "pointer" }}
          >
            ← Back to sign in
          </Link>
        </Box>
      </Box>
    );
  }

  // Step 2: Enter code and new password
  return (
    <Box component="form" onSubmit={handleVerifyReset}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Enter the code sent to{" "}
        <Typography component="span" fontWeight="600">
          {email || initialEmail}
        </Typography>{" "}
        and your new password.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Reset code"
        type="text"
        fullWidth
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
        required
        autoComplete="one-time-code"
        inputProps={{
          inputMode: "numeric",
          pattern: "[0-9]*",
          maxLength: 8,
        }}
        placeholder="Enter 8-digit code"
        sx={{ mb: 2 }}
      />

      <TextField
        label="New password"
        type={showPassword ? "text" : "password"}
        fullWidth
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
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
        sx={{ mb: 2 }}
      />

      <TextField
        label="Confirm new password"
        type={showPassword ? "text" : "password"}
        fullWidth
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        error={confirmPassword !== "" && newPassword !== confirmPassword}
        helperText={
          confirmPassword !== "" && newPassword !== confirmPassword
            ? "Passwords do not match"
            : ""
        }
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || code.length < 8 || newPassword !== confirmPassword}
        sx={{
          mb: 2,
          py: 1.5,
          textTransform: "none",
          fontSize: "1rem",
        }}
      >
        {loading ? "Resetting..." : "Reset password"}
      </Button>

      <Box sx={{ textAlign: "center" }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={onBack}
          sx={{ cursor: "pointer" }}
        >
          ← Request a new code
        </Link>
      </Box>
    </Box>
  );
}
