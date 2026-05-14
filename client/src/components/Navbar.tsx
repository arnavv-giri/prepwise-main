import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { useTheme } from "../context/themeContext";
import { Moon, Sun } from "lucide-react";

const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith("/dashboard")) return "Dashboard";
    if (path.startsWith("/patterns/")) return "Pattern";
    if (path.startsWith("/patterns")) return "Patterns";
    if (path.startsWith("/problems/")) return "Problem";
    if (path.startsWith("/problems")) return "Problems";
    if (path.startsWith("/submissions")) return "Submissions";
    if (path.startsWith("/leaderboard")) return "Leaderboard";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/admin")) return "Admin";
    return "PrepWise";
  };

  return (
    <header className="h-14 flex items-center justify-between px-6
                        bg-card border-b border-border transition-colors shrink-0
                        animate-fade-in">
      <h1 className="text-sm font-semibold text-foreground tracking-tight animate-slide-in-left">
        {getPageTitle()}
      </h1>

      <div className="flex items-center gap-2">

        {/* Streak badge */}
        {(user?.currentStreak ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full
                          bg-orange-500/10 border border-orange-500/20 mr-1
                          animate-fade-in transition-all hover:bg-orange-500/15 hover:border-orange-500/30">
            <span className="text-sm animate-pulse">🔥</span>
            <span className="text-xs font-semibold text-orange-500">
              {user?.currentStreak}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-muted-foreground
                     hover:text-foreground hover:bg-muted
                     transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Toggle theme"
        >
          <span className="transition-transform duration-300 block">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate(`/profile/${user?.userId}`)}
          className="group flex items-center gap-2 px-3 py-1.5 rounded-lg
                     hover:bg-muted transition-all text-sm text-muted-foreground
                     hover:text-foreground"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-border
                         group-hover:ring-primary/40 transition-all"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center
                            justify-center text-primary-foreground text-xs font-bold
                            ring-1 ring-border group-hover:ring-primary/40
                            group-hover:bg-accent-blue transition-all">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="hidden md:block font-medium">{user?.name}</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
