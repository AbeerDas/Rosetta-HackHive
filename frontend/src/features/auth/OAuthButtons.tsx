import { Button, Stack } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuthActions } from "@convex-dev/auth/react";

export function OAuthButtons() {
  const { signIn } = useAuthActions();

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        fullWidth
        startIcon={<GoogleIcon />}
        onClick={() => signIn("google")}
        sx={{
          py: 1.5,
          borderColor: "grey.300",
          color: "text.primary",
          textTransform: "none",
          fontSize: "1rem",
          "&:hover": {
            borderColor: "#4285f4",
            backgroundColor: "rgba(66, 133, 244, 0.04)",
          },
        }}
      >
        Continue with Google
      </Button>
    </Stack>
  );
}
