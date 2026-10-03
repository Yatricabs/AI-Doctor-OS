import LoginForm from "@/components/LoginForm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/demo");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080D14]">
      <LoginForm />
    </div>
  );
}
