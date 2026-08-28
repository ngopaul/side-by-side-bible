import { redirect } from "next/navigation";

export default function Home() {
  redirect("/read/JHN/1?versions=esv,nasb");
}
