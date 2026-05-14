import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      // Clean the token from the URL immediately
      window.history.replaceState({}, "", "/oauth/callback");
      // Set token in auth context so ProtectedRoute sees the user
      loginWithToken(token).then(() => {
        navigate("/dashboard", { replace: true });
      });
    } else {
      navigate("/login?error=oauth_failed", { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent
                        rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
