import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import type { AppRole } from "@shared/auth";
import { useEffect, type ComponentType } from "react";
import { useLocation } from "wouter";

type ProtectedRouteProps = {
  component: ComponentType;
  roles?: AppRole[];
  fallbackPath?: string;
};

export default function ProtectedRoute({
  component: Component,
  roles,
  fallbackPath = "/",
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !user) {
      setLocation(getLoginUrl(location));
      return;
    }

    if (roles && !roles.includes(user.role)) {
      setLocation(fallbackPath);
    }
  }, [fallbackPath, isAuthenticated, loading, location, roles, setLocation, user]);

  if (loading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return null;
  }

  return <Component />;
}
