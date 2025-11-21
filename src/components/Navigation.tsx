import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Fingerprint, Users } from "lucide-react";

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Attendly</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={location.pathname === "/" || location.pathname === "/finger-login" ? "default" : "ghost"}
            asChild
          >
            <Link to="/finger-login">
              <Fingerprint className="h-4 w-4 mr-2" />
              Login Monitor
            </Link>
          </Button>
          <Button
            variant={location.pathname === "/admin/users" ? "default" : "ghost"}
            asChild
          >
            <Link to="/admin/users">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;