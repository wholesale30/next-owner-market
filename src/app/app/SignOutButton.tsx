"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="navbtn navbtn-solid"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
