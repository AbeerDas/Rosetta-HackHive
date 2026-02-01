import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
} from "@mui/material";
import { useAuthActions } from "@convex-dev/auth/react";

interface EmailVerificationProps {
  email: string;
  onBack: () => void;
}

export function EmailVerification({ email, onBack }: EmailVerificationProps) {
  const { signIn } = useAuthActions();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", code);
      formData.set("flow", "email-verification");

      await signIn("password", formData);
      // Success - user will be signed in and redirected
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      if (message.includes("expired")) {
        setError("Verification code has expired. Please request a new one.");
      } else if (message.includes("invalid") || message.includes("Invalid")) {
        setError("Invalid verification code");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    setResent(false);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("flow", "signUp");

      await signIn("password", formData);
      setResent(true);
    } catch (err) {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        We sent a verification code to{" "}
        <Typography component="span" fontWeight="600">
          {email}
        </Typography>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {resent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          A new verification code has been sent to your email.
        </Alert>
      )}

      <TextField
        label="Verification code"
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
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading || code.length < 8}
        sx={{
          mb: 2,
          py: 1.5,
          textTransform: "none",
          fontSize: "1rem",
        }}
      >
        {loading ? "Verifying..." : "Verify email"}
      </Button>

      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Didn't receive a code?{" "}
          <Link
            component="button"
            type="button"
            onClick={handleResend}
            disabled={resending}
            sx={{ cursor: "pointer" }}
          >
            {resending ? "Sending..." : "Resend code"}
          </Link>
        </Typography>
      </Box>

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
