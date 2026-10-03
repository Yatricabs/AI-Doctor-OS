import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protect all /demo and /admin routes. (Patient routes can remain public or use a different auth).
  matcher: ["/demo/:path*", "/admin/:path*"]
};
