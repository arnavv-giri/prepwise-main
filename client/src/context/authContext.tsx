import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import axios from "../api/axios";

interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch real user from server instead of decoding JWT client-side
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await axios.get("/auth/me");
        setUser(res.data.data);
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await axios.post("/auth/login", { email, password });
      const tokenFromServer = res.data.token;
      localStorage.setItem("token", tokenFromServer);

      axios.defaults.headers.common.Authorization = `Bearer ${tokenFromServer}`;
      const meRes = await axios.get("/auth/me");

      setUser(meRes.data.data);
      setToken(tokenFromServer);
    } catch (error) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Used by OAuthCallbackPage after receiving token from URL
  const loginWithToken = async (incomingToken: string) => {
    localStorage.setItem("token", incomingToken);
    axios.defaults.headers.common.Authorization = `Bearer ${incomingToken}`;
    setToken(incomingToken);
    // useEffect will fire on token change and fetch the user automatically
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ) => {
    await axios.post("/auth/register", { name, email, password });
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, loginWithToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
