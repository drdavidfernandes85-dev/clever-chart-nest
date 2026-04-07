import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      <div className="absolute inset-0 bg-grid-pattern opacity-15" />
      <div className="relative text-center space-y-6">
        <h1 className="font-heading text-8xl font-bold text-gradient">404</h1>
        <p className="text-xl text-muted-foreground">Oops! Page not found</p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 font-semibold shadow-lg shadow-primary/20">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
