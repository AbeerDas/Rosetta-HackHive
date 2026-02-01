import { useState } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Divider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { OAuthButtons } from "./OAuthButtons";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { EmailVerification } from "./EmailVerification";
import { PasswordReset } from "./PasswordReset";

type AuthStep = "signIn" | "signUp" | "verify" | "reset" | "resetVerify";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");

  const handleSignUpSuccess = (userEmail: string) => {
    setEmail(userEmail);
    setStep("verify");
  };

  const handleVerificationNeeded = (userEmail: string) => {
    setEmail(userEmail);
    setStep("verify");
  };

  const handleResetRequest = (userEmail: string) => {
    setEmail(userEmail);
    setStep("resetVerify");
  };

  const handleClose = () => {
    // Reset state when closing
    setStep("signIn");
    setEmail("");
    onClose();
  };

  const getTitle = () => {
    switch (step) {
      case "verify":
        return "Verify your email";
      case "reset":
      case "resetVerify":
        return "Reset your password";
      default:
        return "Sign in or create an account";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 2,
          maxWidth: 440,
        },
      }}
    >
      <IconButton
        onClick={handleClose}
        aria-label="Close"
        sx={{
          position: "absolute",
          right: 16,
          top: 16,
          color: "text.secondary",
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ px: 3, py: 4 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h5" fontWeight="600">
            {getTitle()}
          </Typography>
        </Box>

        {(step === "signIn" || step === "signUp") && (
          <>
            <OAuthButtons />
            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Or continue with
              </Typography>
            </Divider>
          </>
        )}

        {step === "signIn" && (
          <SignInForm
            onForgotPassword={() => setStep("reset")}
            onSwitchToSignUp={() => setStep("signUp")}
            onVerificationNeeded={handleVerificationNeeded}
          />
        )}

        {step === "signUp" && (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={() => setStep("signIn")}
          />
        )}

        {step === "verify" && (
          <EmailVerification email={email} onBack={() => setStep("signIn")} />
        )}

        {step === "reset" && (
          <PasswordReset
            onSuccess={handleResetRequest}
            onBack={() => setStep("signIn")}
          />
        )}

        {step === "resetVerify" && (
          <PasswordReset
            email={email}
            isVerifying
            onBack={() => setStep("reset")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
